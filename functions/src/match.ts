import * as express from "express";

// eslint-disable-next-line new-cap
export const router = express.Router();

router.get("/", (req, res) => {
  if (!req.session || !req.session.passport || !req.session.userId) {
    res.redirect("/");
    return;
  }

  res.render("match", {
    user: req.session.passport.user,
  });
});
