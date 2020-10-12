import { getConfig } from "./config";
import path from "path";

describe("config", () => {
  describe("test", () => {
    beforeEach(() => (process.env.NODE_ENV = "test"));

    it("gets the correct configuration", () => {
      const config = getConfig();

      expect(config.out).toBe("./test");
      expect(config.content.pages).toBe(path.join(path.resolve(process.cwd()), "content/pages/"));
    });
  });

  describe("dev", () => {
    beforeEach(() => (process.env.NODE_ENV = "development"));

    it("gets the correct configuration", () => {
      const config = getConfig();

      expect(config.out).toBe("./public");
      expect(config.content.pages).toBe(path.join(path.resolve(process.cwd()), "content/pages/"));
    });
  });

  describe("prod", () => {
    beforeEach(() => (process.env.NODE_ENV = "production"));

    it("gets the correct configuration", () => {
      const config = getConfig();

      expect(config.out).toBe("./public");
      expect(config.content.pages).toBe(path.join(path.resolve(process.cwd()), "content/pages/"));
    });
  });
});