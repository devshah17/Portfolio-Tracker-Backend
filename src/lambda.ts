import serverlessExpress from "@vendia/serverless-express";
import { app, connectToDb } from "./index.js";
import { updateTickerPrices } from "./services/cronServices.js";
import { Context, APIGatewayProxyEvent } from "aws-lambda";

let serverlessExpressHandler: any;

async function setup(event: any, context: Context) {
  await connectToDb();
  // @ts-ignore
  serverlessExpressHandler = serverlessExpress({ app });
  return serverlessExpressHandler(event, context);
}

export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  if (serverlessExpressHandler) {
    return serverlessExpressHandler(event, context);
  }
  return setup(event, context);
};

export const cronHandler = async () => {
  console.log("Lambda: Triggering cron job...");
  await connectToDb();
  await updateTickerPrices();
  return { status: "success" };
};
