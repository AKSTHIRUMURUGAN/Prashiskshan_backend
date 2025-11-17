import ImageKit from "imagekit";
import config from "./index.js";

const imagekitClient = new ImageKit({
  publicKey: config.imagekit.publicKey,
  privateKey: config.imagekit.privateKey,
  urlEndpoint: config.imagekit.urlEndpoint,
});

export default imagekitClient;

