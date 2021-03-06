import * as express from "express";
import * as moment from "moment-timezone";
import * as ordinal from "ordinal";
import {
  IPrSetting,
  getBaseDate,
  checkPrData,
  getPrDataFromCacheOrRunCreate,
  placementToPointList,
  isSavedErrorData,
} from "./pr";

// eslint-disable-next-line new-cap
export const router = express.Router();

const usprSetting: IPrSetting = {
  countryCode: "US",
  minimumEntrantNum: 241,
  collectionName: "usprs",
  expireColonaLimitation: 1630422000,
  displaySetting: {
    countryName: "UnitedStates",
    prName: "JUSPR",
    isRef: false,
  },
};

router.get("/:dateStr?/check", (req, res) => {
  checkUspr();

  /**
   * USPRのデータがあるかどうかのチェック
   */
  async function checkUspr() {
    const baseDate = getBaseDate(req.params.dateStr);
    // 未来日時禁止
    if (baseDate.isAfter(moment().tz("Asia/Tokyo"))) {
      return false;
    }
    const existence: boolean = await checkPrData(usprSetting, baseDate);
    return res.send(existence);
  }
});

router.get("/:dateStr?", (req, res) => {
  renderUspr();

  /**
   * USPRのレンダリング
   */
  async function renderUspr() {
    const baseDate = getBaseDate(req.params.dateStr as string);
    // 未来日時禁止
    if (baseDate.isAfter(moment().tz("Asia/Tokyo"))) {
      res.redirect(req.baseUrl);
    }
    const cachedPrData = await getPrDataFromCacheOrRunCreate(
      usprSetting,
      baseDate
    );
    if (!cachedPrData) {
      res.render("pr/wait");
      return;
    }

    if (isSavedErrorData(cachedPrData)) {
      res.render("pr/error");
      return;
    }

    res.render("pr/index", {
      pr: cachedPrData.data.prData,
      events: cachedPrData.data.events,
      prSetting: usprSetting,
      moment,
      ordinal,
      baseDate,
      placementToPointList,
    });
  }
});
