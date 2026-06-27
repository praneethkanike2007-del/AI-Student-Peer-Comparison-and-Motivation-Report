import { app } from "./app.js";
import { ensureDemoAccounts } from "./utils/bootstrap.js";

const port = Number(process.env.PORT || 5000);

async function start() {
  try {
    await ensureDemoAccounts();
    console.log("Demo accounts ready");
  } catch (error) {
    console.error("Failed to bootstrap demo accounts", error);
  }

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

start();
