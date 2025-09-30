import e from "express";
import {
  create,
  getAll,
  update,
  getAllFiltered,
  updatePassword,
  inactivateUser,
} from "../services/user.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 *
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *           example: 1
 *         email:
 *           type: string
 *           description: User email
 *           example: user@example.com
 *         name:
 *           type: string
 *           description: User full name
 *           example: John Doe
 *         permissions:
 *           type: integer
 *           description: User permission bitfield
 *           example: 1
 *         permissionsDetails:
 *           type: object
 *           properties:
 *             isSuperadmin:
 *               type: boolean
 *               example: false
 *             isHSZC:
 *               type: boolean
 *               example: false
 *             isAdmin:
 *               type: boolean
 *               example: false
 *             isPrivileged:
 *               type: boolean
 *               example: false
 *             isStandard:
 *               type: boolean
 *               example: true
 *         tableAccess:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               userId:
 *                 type: integer
 *                 example: 1
 *               tableName:
 *                 type: string
 *                 example: kompetencia
 *               access:
 *                 type: integer
 *                 example: 15
 *               permissionsDetails:
 *                 type: object
 *                 properties:
 *                   canDelete:
 *                     type: boolean
 *                     example: true
 *                   canUpdate:
 *                     type: boolean
 *                     example: true
 *                   canCreate:
 *                     type: boolean
 *                     example: true
 *                   canRead:
 *                     type: boolean
 *                     example: true
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Retrieves a list of all users with their permissions and table access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const data = await getAll(token);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /users/getByEmail/{email}:
 *   get:
 *     summary: Get user by email
 *     description: Retrieves a specific user by their email address
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email address
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/getByEmail/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const data = await getAll();
    const user = data.find((user) => user.email === email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /users/filtered:
 *   get:
 *     summary: Get filtered users
 *     description: Retrieves a filtered list of users based on specific criteria
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A filtered list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get("/filtered", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const data = await getAllFiltered(token);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching filtered users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user
 *     description: Create a new user with specified permissions and table access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *               - password
 *               - permissions
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: User email address
 *               name:
 *                 type: string
 *                 example: John Doe
 *                 description: User full name
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *                 description: User password
 *               permissions:
 *                 type: integer
 *                 example: 1
 *                 description: User permission bitfield
 *               tableAccess:
 *                 type: array
 *                 description: Access permissions for specific tables
 *                 items:
 *                   type: object
 *                   properties:
 *                     tableName:
 *                       type: string
 *                       example: kompetencia
 *                     access:
 *                       type: integer
 *                       example: 15
 *               alapadatok_id:
 *                 type: integer
 *                 example: 1
 *                 description: School ID the user is associated with (if applicable)
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post("/", async (req, res) => {
  const {
    email,
    name,
    password,
    permissions,
    tableAccess,
    alapadatokId,
    isActive,
  } = req.body;

  try {
    await create(
      email,
      name,
      password,
      permissions,
      tableAccess,
      alapadatokId,
      isActive
    );
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     description: Update an existing user's details, permissions, and table access
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: User email address
 *               name:
 *                 type: string
 *                 example: John Doe
 *                 description: User full name
 *               password:
 *                 type: string
 *                 format: password
 *                 example: newSecurePassword123
 *                 description: User password (only if changing)
 *               permissions:
 *                 type: integer
 *                 example: 1
 *                 description: User permission bitfield
 *               tableAccess:
 *                 type: array
 *                 description: Access permissions for specific tables
 *                 items:
 *                   type: object
 *                   properties:
 *                     tableName:
 *                       type: string
 *                       example: kompetencia
 *                     access:
 *                       type: integer
 *                       example: 15
 *               alapadatok_id:
 *                 type: integer
 *                 example: 1
 *                 description: School ID the user is associated with
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { email, name, permissions, tableAccess, alapadatokId, isActive } =
    req.body;

  try {
    await update(
      id,
      email,
      name,
      permissions,
      tableAccess,
      alapadatokId,
      isActive
    );
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/:id/password", async (req, res) => {
  const { id } = req.params;
  const { newPassword, newPasswordConfirm } = req.body;

  try {
    await updatePassword(id, newPassword, newPasswordConfirm);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /users/inactivate/{id}:
 *   delete:
 *     summary: Inactivate user
 *     description: Inactivate a user by setting their isActive status to false
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/inactivate/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await inactivateUser(id);
    res.status(200).json({ message: "User inactivated successfully" });
  } catch (error) {
    console.error("Error inactivating user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
