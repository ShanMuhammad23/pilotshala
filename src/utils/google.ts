// import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (token: string) => {
  try {
    // const ticket = await client.verifyIdToken({
    //   access_token: token,
    //   idToken: token,
    //   audience: process.env.GOOGLE_CLIENT_ID,
    // });

    const { data } = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`
    );
    console.log(data);
    return data;
  } catch (error: any) {
    console.log(error);
    if (error?.message.toLowerCase().includes("too late")) return undefined;
    return null;
  }
};
