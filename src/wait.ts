import axios from "axios";

wait();

async function wait() {
  // NOTE: 最大3000秒で諦める
  for (let i = 0; i < 1000; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const res = await check();
    if (res) {
      return;
    }
  }
}

async function check(): Promise<boolean> {
  const pathname = location.pathname;
  const checkPath = pathname.replace("/jpr", "/jpr/check");
  const res = await axios.get(checkPath);
  if (res.data) {
    location.reload();
    return true;
  }
  return false;
}
