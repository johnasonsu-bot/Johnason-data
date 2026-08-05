const { sendSuccess } = require("../../common/utils/response");
const platformService = require("./platform.service");

async function overview(req, res) {
  const result = await platformService.getOverview();
  return sendSuccess(res, result);
}

module.exports = {
  overview
};
