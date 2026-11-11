use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use js_sys::Float64Array;
#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;

#[cfg(target_arch = "wasm32")]
thread_local! {
    // One stable four-number result buffer per WASM instance/thread.
    static MOTION_BUFFER: RefCell<[f64; 4]> = const { RefCell::new([0.0; 4]) };
}

/// Calculate one fixed-timestep movement step for the player.
///
/// The browser still owns collision detection, platform clamping, jump timing,
/// rendering, input, and all game rules. This function only performs the
/// numerical integration used by the JavaScript game loop.
fn calculate_player_motion(
    x: f64,
    y: f64,
    vertical_velocity: f64,
    axis: f64,
    dt: f64,
    speed: f64,
    gravity: f64,
    max_fall_speed: f64,
) -> [f64; 4] {
    let horizontal_velocity = axis * speed;
    let next_x = x + horizontal_velocity * dt;

    let next_vertical_velocity =
        (vertical_velocity + gravity * dt).min(max_fall_speed);
    let next_y = y + next_vertical_velocity * dt;

    [
        next_x,
        next_y,
        horizontal_velocity,
        next_vertical_velocity,
    ]
}

/// Legacy allocating result retained for parity checks and before/after benchmarks.
#[wasm_bindgen]
pub fn step_player_motion(
    x: f64,
    y: f64,
    vertical_velocity: f64,
    axis: f64,
    dt: f64,
    speed: f64,
    gravity: f64,
    max_fall_speed: f64,
) -> Box<[f64]> {
    calculate_player_motion(
        x,
        y,
        vertical_velocity,
        axis,
        dt,
        speed,
        gravity,
        max_fall_speed,
    )
    .to_vec()
    .into_boxed_slice()
}

/// Create a typed-array view over the reusable WASM result buffer.
///
/// The returned view stays backed by WASM memory and should be created once,
/// then read after each call to step_player_motion_into_buffer. If WASM memory
/// grows, callers must request a fresh view.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn create_motion_buffer() -> Float64Array {
    MOTION_BUFFER.with(|buffer| {
        // SAFETY: the thread-local array has a stable address for the lifetime
        // of this WASM thread. The view is refreshed by the JS caller if memory
        // growth detaches its underlying ArrayBuffer.
        unsafe { Float64Array::view(&*buffer.borrow()) }
    })
}

/// Update the reusable result buffer without allocating a new result array.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn step_player_motion_into_buffer(
    x: f64,
    y: f64,
    vertical_velocity: f64,
    axis: f64,
    dt: f64,
    speed: f64,
    gravity: f64,
    max_fall_speed: f64,
) {
    let result = calculate_player_motion(
        x,
        y,
        vertical_velocity,
        axis,
        dt,
        speed,
        gravity,
        max_fall_speed,
    );

    MOTION_BUFFER.with(|buffer| {
        buffer.borrow_mut().copy_from_slice(&result);
    });
}

#[cfg(test)]
mod tests {
    use super::{calculate_player_motion, step_player_motion};

    fn close(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-9,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn right_input_moves_right_and_applies_gravity() {
        let step = step_player_motion(100.0, 50.0, 0.0, 1.0, 0.1, 300.0, 10.0, 900.0);

        close(step[0], 130.0);
        close(step[1], 50.1);
        close(step[2], 300.0);
        close(step[3], 1.0);
    }

    #[test]
    fn left_input_moves_left() {
        let step = step_player_motion(100.0, 50.0, 0.0, -1.0, 0.1, 300.0, 10.0, 900.0);

        close(step[0], 70.0);
        close(step[2], -300.0);
    }

    #[test]
    fn no_horizontal_input_keeps_horizontal_position() {
        let step = step_player_motion(100.0, 50.0, 0.0, 0.0, 0.1, 300.0, 10.0, 900.0);

        close(step[0], 100.0);
        close(step[2], 0.0);
    }

    #[test]
    fn falling_speed_is_capped() {
        let step = step_player_motion(0.0, 0.0, 895.0, 0.0, 0.1, 300.0, 100.0, 900.0);

        close(step[3], 900.0);
        close(step[1], 90.0);
    }

    #[test]
    fn reusable_buffer_calculation_matches_the_legacy_result() {
        let expected = step_player_motion(100.0, 50.0, -20.0, 1.0, 1.0 / 60.0, 300.0, 1580.0, 900.0);
        let actual = calculate_player_motion(100.0, 50.0, -20.0, 1.0, 1.0 / 60.0, 300.0, 1580.0, 900.0);

        for index in 0..4 {
            close(actual[index], expected[index]);
        }
    }
}
