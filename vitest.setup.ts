// React 19 requires this flag before `act` will drive state updates in a
// non-browser test environment. Without it every test emits a
// "not configured to support act(...)" warning that drowns out real failures.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
