import * as functions from "firebase-functions";
import * as express from "express";

const app = express();

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

exports.app = functions.https.onRequest(app);
