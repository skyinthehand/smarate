import * as express from "express";
import * as moment from "moment-timezone";
import * as ordinal from "ordinal";
import {
  IPrSetting,
  getBaseDate,
  checkPrData,
  getPrDataFromCacheOrRunCreate,
  placementToPointList,
} from "./pr";

// eslint-disable-next-line new-cap
export const router = express.Router();

const jprSetting: IPrSetting = {
  countryCode: "JP",
  minimumEntrantNum: 61,
  collectionName: "jprs",
  expireColonaLimitation: 1633014000,
};

router.get("/check/:dateStr?", (req, res) => {
  checkJpr();

  /**
   * JPRのデータがあるかどうかのチェック
   */
  async function checkJpr() {
    const baseDate = getBaseDate(req.params.dateStr);
    // 未来日時禁止
    if (baseDate.isAfter(moment().tz("Asia/Tokyo"))) {
      return false;
    }
    const existence: boolean = await checkPrData(jprSetting, baseDate);
    return res.send(existence);
  }
});

router.get("/:dateStr?", (req, res) => {
  renderJpr();

  /**
   * JPRのレンダリング
   */
  async function renderJpr() {
    const baseDate = getBaseDate(req.params.dateStr as string);
    // 未来日時禁止
    if (baseDate.isAfter(moment().tz("Asia/Tokyo"))) {
      res.redirect(req.baseUrl);
    }
    const cachedJprData = await getPrDataFromCacheOrRunCreate(
      jprSetting,
      baseDate
    );
    if (!cachedJprData) {
      res.render("jpr/wait");
      return;
    }

    res.render("jpr/index", {
      jpr: cachedJprData,
      ordinal,
      baseDate,
      placementToPointList,
    });
  }
});
