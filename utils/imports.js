// External dependencies
import express from "express";
import cors from "cors";
import expressSession from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";

// Swagger documentation
import { setupSwagger } from "./swagger.js";

// Controllers
import alapadatokRouter from "../controllers/alapadatok.controller.js";
import tanugyi_adatok from "../controllers/tanugyi_adatok.controller.js";
import kompetencia from "../controllers/kompetencia.controller.js";
import tanulo_letszam from "../controllers/tanulo_letszam.controller.js";
import felvettek_szama from "../controllers/felvettek_szama.controller.js";
import userRouter from "../controllers/user.controller.js";
import authRouter from "../controllers/auth.controller.js";
import cacheRouter from "../controllers/cache.controller.js";
import logRouter from "../controllers/log.controller.js";
import tableRouter from "../controllers/tablelist.controller.js";
import egyOktatoraJutoTanuloRouter from "../controllers/egy_oktatora_juto_tanulo.controller.js";
import szmszRouter from "../controllers/szmsz.controller.js";
import versenyekRouter from "../controllers/versenyek.controller.js";
import dobbantoRouter from "../controllers/dobbanto.controller.js";
import elegedettsegRouter from "../controllers/elegedettseg.controller.js";
import elegedettsegMeresRouter from "../controllers/elegedettseg_meres.controller.js";
import elhelyezkedesRouter from "../controllers/elhelyezkedes.controller.js";
import hhEsHHHRouter from "../controllers/hh_es_hhh_nevelesu_tanulok.controller.js";
import lemorzsolodasRouter from "../controllers/lemorzsolodas.controller.js";
import intezmenyiNeveltsegRouter from "../controllers/intezmenyi_neveltseg.controller.js";
import muhelyiskolaRouter from "../controllers/muhelyiskola.controller.js";
import nszfhRouter from "../controllers/nszfh.controller.js";
import sajatosNevelesuTanulokRouter from "../controllers/sajatos_nevelesu_tanulok.controller.js";
import szakmaiVizsgaEredmenyekRouter from "../controllers/szakmai_vizsga_eredmenyek.controller.js";
import vizsgaeredmenyekRouter from "../controllers/vizsgaeredmenyek.controller.js";
import oktatoEgyebTevRouter from "../controllers/oktato_egyeb_tev.controller.js";
import alkalmazottakMunkauyRouter from "../controllers/alkalmazottak_munkaugy.controller.js";
import healthRouter from "../controllers/health.controller.js";

// Middleware
import logMiddleware from "../middleware/log.middleware.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import endpointAccessMiddleware from "../middleware/endpointAccess.middleware.js";
import cacheMiddleware from "../middleware/cache.middleware.js";

// Export everything for single import
export {
  express,
  cors,
  alapadatokRouter,
  tanugyi_adatok,
  kompetencia,
  tanulo_letszam,
  felvettek_szama,
  userRouter,
  authRouter,
  cacheRouter,
  logRouter,
  logMiddleware,
  authMiddleware,
  expressSession,
  PrismaSessionStore,
  endpointAccessMiddleware,
  cacheMiddleware,
  setupSwagger,
  tableRouter,
  egyOktatoraJutoTanuloRouter,
  szmszRouter,
  versenyekRouter,
  dobbantoRouter,
  elegedettsegRouter,
  elegedettsegMeresRouter,
  elhelyezkedesRouter,
  hhEsHHHRouter,
  lemorzsolodasRouter,
  intezmenyiNeveltsegRouter,
  muhelyiskolaRouter,
  nszfhRouter,
  sajatosNevelesuTanulokRouter,
  szakmaiVizsgaEredmenyekRouter,
  vizsgaeredmenyekRouter,
  oktatoEgyebTevRouter,
  alkalmazottakMunkauyRouter,
  healthRouter,
};
