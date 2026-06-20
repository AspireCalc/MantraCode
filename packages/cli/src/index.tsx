import { existsSync, unlinkSync, rmdirSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { Home } from "./screens/home";
import { NewSession } from "./screens/new-session";
import { Session } from "./screens/session";
import { Profile } from "./screens/profile";
import { startTunnel } from "./lib/tunnel";
import { MANTRACODE_VERSION } from "./version";

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  console.log(`MantraCode v${MANTRACODE_VERSION}`);
  process.exit(0);
}

if (args.includes("logout")) {
  const authFile = join(homedir(), ".mantracode", "auth.json");
  try { unlinkSync(authFile); } catch { }
  console.log("Signed out.");
  process.exit(0);
}

if (args.includes("--uninstall")) {
  const authDir = join(homedir(), ".mantracode");
  try { unlinkSync(join(authDir, "auth.json")); } catch { }

  try {
    const { execSync } = await import("child_process");
    execSync("npm uninstall -g @aspirenx/mantracode", { stdio: "inherit" });
  } catch { }

  console.log("MantraCode has been removed from your machine.");
  process.exit(0);
}

const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home />},
      { path: "sessions/new", element: <NewSession /> },
      { path: "sessions/:id", element: <Session /> },
      { path: "profile", element: <Profile /> },
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />
}

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);

startTunnel();
