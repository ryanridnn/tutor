import readline from "readline";

export const keyKiller = (cb: () => void) => {
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on("keypress", (str, key) => {
    process.stdout.write(str);
    if (key.name === "c") {
      cb();

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    }
  });

  return () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  };
};
