import serverless from "serverless-http";
import app from "./app.js";

export const handler = serverless(app, {
  request: async (req: any, event: any) => {
    try {
      req.body = JSON.parse(event.body);
    } catch (error) {
      console.error("Error parsing body OR no body is present!");
    }
  },
});
