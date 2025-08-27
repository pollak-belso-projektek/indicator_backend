/**
 * Utility functions for working with permissions
 *
 * @swagger
 * components:
 *   schemas:
 *     UserPermissions:
 *       type: object
 *       properties:
 *         isSuperadmin:
 *           type: boolean
 *           description: Has superadmin privileges
 *           example: false
 *         isHSZC:
 *           type: boolean
 *           description: Has HSZC privileges
 *           example: false
 *         isAdmin:
 *           type: boolean
 *           description: Has admin privileges
 *           example: false
 *         isPrivileged:
 *           type: boolean
 *           description: Has privileged user status
 *           example: true
 *         isStandard:
 *           type: boolean
 *           description: Has standard user privileges
 *           example: true
 *
 *     TableAccess:
 *       type: object
 *       properties:
 *         canDelete:
 *           type: boolean
 *           description: Can delete records in the table
 *           example: false
 *         canUpdate:
 *           type: boolean
 *           description: Can update records in the table
 *           example: true
 *         canCreate:
 *           type: boolean
 *           description: Can create new records in the table
 *           example: true
 *         canRead:
 *           type: boolean
 *           description: Can read records from the table
 *           example: true
 */

/**
 * Map user permissions to a readable format
 * @param {number} permissionsBitfield - The permissions bit field
 * @returns {Object} - Object with boolean flags for each permission type
 */
export function mapUserPermissions(permissionsBitfield) {
  return {
    isSuperadmin: Boolean(permissionsBitfield & 0b10000),
    isHSZC: Boolean(permissionsBitfield & 0b01000),
    isAdmin: Boolean(permissionsBitfield & 0b00100),
    isPrivileged: Boolean(permissionsBitfield & 0b00010),
    isStandard: Boolean(permissionsBitfield & 0b00001),
  };
}

/**
 * Map table access permissions to a readable format
 * @param {number} accessBitfield - The access bit field
 * @returns {Object} - Object with boolean flags for each access type
 */
export function mapTableAccess(accessBitfield) {
  return {
    canDelete: Boolean(accessBitfield & 0b01000),
    canUpdate: Boolean(accessBitfield & 0b00100),
    canCreate: Boolean(accessBitfield & 0b00010),
    canRead: Boolean(accessBitfield & 0b00001),
  };
}

/**
 * Enrich a user object with permission details
 * @param {Object} user - The user object to enrich
 * @returns {Object} - The enriched user object
 */
export function enrichUserWithPermissions(user) {
  if (!user) return user;

  // Add permission details to user
  user.permissionsDetails = mapUserPermissions(user.permissions);

  // Add permission details to table access if available
  if (user.tableAccess && user.tableAccess.length > 0) {
    user.tableAccess.forEach((access) => {
      access.tableName = access.table.name;
      access.permissionsDetails = mapTableAccess(access.access);
    });
  }

  return user;
}
