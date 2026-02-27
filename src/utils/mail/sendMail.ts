import axios from "axios";
import { SendMail } from "../../types/types";

export async function sendMail({
  subject,
  body,
  to,
  templateName,
  replacements,
  consoleMessage,
}: SendMail) {
  try {
    const response = await axios.post(
      `${process.env.EXPENSE_TRACKER_FUNCTIONS_URL}/sendMail`,
      {
        to,
        subject,
        body,
        templateName,
        replacements,
      },
    );

    if (consoleMessage) {
      console.log(consoleMessage);
    }

    return response.data;
  } catch (error: any) {
    console.error(
      "Failed to send email via Cloud Function:",
      error.response?.data || error.message,
    );
    throw error;
  }
}
