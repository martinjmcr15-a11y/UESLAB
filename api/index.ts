import app from "../dist/server.cjs";

const finalApp = (app as any).default || app;
export default finalApp;

