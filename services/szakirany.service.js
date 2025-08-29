import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";

const pattern = new ServicePattern("szakirany", "id");

export async function getAll() {
    return await pattern.findAll();
}
