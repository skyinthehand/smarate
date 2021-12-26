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
  displaySetting: {
    countryName: "Japan",
    prName: "JJPR",
  },
};

router.get("/:dateStr?/check", (req, res) => {
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
    const cachedPrData = await getPrDataFromCacheOrRunCreate(
      jprSetting,
      baseDate
    );
    if (!cachedPrData || !cachedPrData.data) {
      res.render("pr/wait");
      return;
    }

    res.render("pr/index", {
      pr: cachedPrData.data.prData,
      events: cachedPrData.data.events,
      scheduledEvents: cachedPrData.data.scheduledEvents,
      prSetting: jprSetting,
      moment,
      ordinal,
      baseDate,
      placementToPointList,
    });
  }
});
