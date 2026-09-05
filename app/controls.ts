import { emptyInput, type ControlInput } from './dynamics';
export function createInputState() {
  const held = new Set<string>();
  return {
    held,
    press: (key: string) => held.add(key),
    release: (key: string) => held.delete(key),
    clear: () => held.clear(),
    read(): ControlInput {
      const input = emptyInput();
      input.pitch = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
      input.roll = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
      input.rudder = Number(held.has('d')) - Number(held.has('a'));
      input.throttle = Number(held.has('w')) - Number(held.has('s'));
      input.brake = held.has('b') || held.has(' '); return input;
    },
  };
}

// All animated systems receive this clock's simulated time, including weather.
export function createSimulationClock() {
  let accumulator = 0;
  return {
    reset() { accumulator = 0; },
    advance(realSeconds: number, running: boolean, rate: number, step: () => boolean) {
      if (!running) { accumulator = 0; return 0; }
      accumulator += Math.min(realSeconds, .1) * rate;
      let elapsed = 0;
      while (accumulator + 1e-10 >= 1 / 60) {
        accumulator -= 1 / 60; elapsed += 1 / 60;
        if (!step()) { accumulator = 0; break; }
      }
      return elapsed;
    },
  };
}
