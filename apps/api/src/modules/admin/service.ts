import type { FastifyInstance } from "fastify";
import { ProjectTeamSyncService } from "../projects/team-sync-service.js";
import { AdminAuditSystemService } from "./services/audit-system.js";
import { AdminCatalogsSettingsOverviewService } from "./services/catalogs-settings-overview.js";
import { AdminDatabaseBackupService } from "./services/database-backup.js";
import { AdminRolesAccessService } from "./services/roles-access.js";
import { AdminSignupInvitesService } from "./services/signup-invites.js";
import { AdminTeamsService } from "./services/teams.js";
import { AdminUsersService } from "./services/users.js";

export class AdminService {
  private readonly usersService: AdminUsersService;
  private readonly signupInvitesService: AdminSignupInvitesService;
  private readonly teamsService: AdminTeamsService;
  private readonly rolesAccessService: AdminRolesAccessService;
  private readonly auditSystemService: AdminAuditSystemService;
  private readonly databaseBackupService: AdminDatabaseBackupService;
  private readonly catalogsSettingsOverviewService: AdminCatalogsSettingsOverviewService;

  constructor(app: FastifyInstance) {
    const teamSync = new ProjectTeamSyncService(app);

    this.usersService = new AdminUsersService(app, teamSync);
    this.signupInvitesService = new AdminSignupInvitesService(app, teamSync);
    this.teamsService = new AdminTeamsService(app, teamSync);
    this.rolesAccessService = new AdminRolesAccessService(app, teamSync);
    this.auditSystemService = new AdminAuditSystemService(app, teamSync);
    this.databaseBackupService = new AdminDatabaseBackupService(app, teamSync);
    this.catalogsSettingsOverviewService = new AdminCatalogsSettingsOverviewService(app, teamSync);
  }

  async listUsers(...args: Parameters<AdminUsersService["listUsers"]>) {
    return this.usersService.listUsers(...args);
  }

  async createUser(...args: Parameters<AdminUsersService["createUser"]>) {
    return this.usersService.createUser(...args);
  }

  async updateUser(...args: Parameters<AdminUsersService["updateUser"]>) {
    return this.usersService.updateUser(...args);
  }

  async previewOffboarding(...args: Parameters<AdminUsersService["previewOffboarding"]>) {
    return this.usersService.previewOffboarding(...args);
  }

  async executeOffboarding(...args: Parameters<AdminUsersService["executeOffboarding"]>) {
    return this.usersService.executeOffboarding(...args);
  }

  async listSignupRequests(...args: Parameters<AdminSignupInvitesService["listSignupRequests"]>) {
    return this.signupInvitesService.listSignupRequests(...args);
  }

  async approveSignupRequest(...args: Parameters<AdminSignupInvitesService["approveSignupRequest"]>) {
    return this.signupInvitesService.approveSignupRequest(...args);
  }

  async rejectSignupRequest(...args: Parameters<AdminSignupInvitesService["rejectSignupRequest"]>) {
    return this.signupInvitesService.rejectSignupRequest(...args);
  }

  async listInternalInvites(...args: Parameters<AdminSignupInvitesService["listInternalInvites"]>) {
    return this.signupInvitesService.listInternalInvites(...args);
  }

  async createInternalInvite(...args: Parameters<AdminSignupInvitesService["createInternalInvite"]>) {
    return this.signupInvitesService.createInternalInvite(...args);
  }

  async revokeInternalInvite(...args: Parameters<AdminSignupInvitesService["revokeInternalInvite"]>) {
    return this.signupInvitesService.revokeInternalInvite(...args);
  }

  async resendInternalInvite(...args: Parameters<AdminSignupInvitesService["resendInternalInvite"]>) {
    return this.signupInvitesService.resendInternalInvite(...args);
  }

  async listGuestInvites(...args: Parameters<AdminSignupInvitesService["listGuestInvites"]>) {
    return this.signupInvitesService.listGuestInvites(...args);
  }

  async createGuestInvite(...args: Parameters<AdminSignupInvitesService["createGuestInvite"]>) {
    return this.signupInvitesService.createGuestInvite(...args);
  }

  async revokeGuestInvite(...args: Parameters<AdminSignupInvitesService["revokeGuestInvite"]>) {
    return this.signupInvitesService.revokeGuestInvite(...args);
  }

  async extendGuestInvite(...args: Parameters<AdminSignupInvitesService["extendGuestInvite"]>) {
    return this.signupInvitesService.extendGuestInvite(...args);
  }

  async listTeams(...args: Parameters<AdminTeamsService["listTeams"]>) {
    return this.teamsService.listTeams(...args);
  }

  async getTeam(...args: Parameters<AdminTeamsService["getTeam"]>) {
    return this.teamsService.getTeam(...args);
  }

  async createTeam(...args: Parameters<AdminTeamsService["createTeam"]>) {
    return this.teamsService.createTeam(...args);
  }

  async updateTeam(...args: Parameters<AdminTeamsService["updateTeam"]>) {
    return this.teamsService.updateTeam(...args);
  }

  async dissolveTeam(...args: Parameters<AdminTeamsService["dissolveTeam"]>) {
    return this.teamsService.dissolveTeam(...args);
  }

  async getRolesMatrix(...args: Parameters<AdminRolesAccessService["getRolesMatrix"]>) {
    return this.rolesAccessService.getRolesMatrix(...args);
  }

  async listRoles(...args: Parameters<AdminRolesAccessService["listRoles"]>) {
    return this.rolesAccessService.listRoles(...args);
  }

  async getRole(...args: Parameters<AdminRolesAccessService["getRole"]>) {
    return this.rolesAccessService.getRole(...args);
  }

  async createRole(...args: Parameters<AdminRolesAccessService["createRole"]>) {
    return this.rolesAccessService.createRole(...args);
  }

  async updateRole(...args: Parameters<AdminRolesAccessService["updateRole"]>) {
    return this.rolesAccessService.updateRole(...args);
  }

  async replaceRolePermissions(...args: Parameters<AdminRolesAccessService["replaceRolePermissions"]>) {
    return this.rolesAccessService.replaceRolePermissions(...args);
  }

  async getRoleAccess(...args: Parameters<AdminRolesAccessService["getRoleAccess"]>) {
    return this.rolesAccessService.getRoleAccess(...args);
  }

  async replaceRoleAccess(...args: Parameters<AdminRolesAccessService["replaceRoleAccess"]>) {
    return this.rolesAccessService.replaceRoleAccess(...args);
  }

  async deleteRole(...args: Parameters<AdminRolesAccessService["deleteRole"]>) {
    return this.rolesAccessService.deleteRole(...args);
  }

  async listPermissions(...args: Parameters<AdminRolesAccessService["listPermissions"]>) {
    return this.rolesAccessService.listPermissions(...args);
  }

  async createPermission(...args: Parameters<AdminRolesAccessService["createPermission"]>) {
    return this.rolesAccessService.createPermission(...args);
  }

  async updatePermission(...args: Parameters<AdminRolesAccessService["updatePermission"]>) {
    return this.rolesAccessService.updatePermission(...args);
  }

  async deactivatePermission(...args: Parameters<AdminRolesAccessService["deactivatePermission"]>) {
    return this.rolesAccessService.deactivatePermission(...args);
  }

  async listPrograms(...args: Parameters<AdminRolesAccessService["listPrograms"]>) {
    return this.rolesAccessService.listPrograms(...args);
  }

  async createProgram(...args: Parameters<AdminRolesAccessService["createProgram"]>) {
    return this.rolesAccessService.createProgram(...args);
  }

  async updateProgram(...args: Parameters<AdminRolesAccessService["updateProgram"]>) {
    return this.rolesAccessService.updateProgram(...args);
  }

  async deactivateProgram(...args: Parameters<AdminRolesAccessService["deactivateProgram"]>) {
    return this.rolesAccessService.deactivateProgram(...args);
  }

  async listResources(...args: Parameters<AdminRolesAccessService["listResources"]>) {
    return this.rolesAccessService.listResources(...args);
  }

  async createResource(...args: Parameters<AdminRolesAccessService["createResource"]>) {
    return this.rolesAccessService.createResource(...args);
  }

  async updateResource(...args: Parameters<AdminRolesAccessService["updateResource"]>) {
    return this.rolesAccessService.updateResource(...args);
  }

  async deactivateResource(...args: Parameters<AdminRolesAccessService["deactivateResource"]>) {
    return this.rolesAccessService.deactivateResource(...args);
  }

  async listActions(...args: Parameters<AdminRolesAccessService["listActions"]>) {
    return this.rolesAccessService.listActions(...args);
  }

  async createAction(...args: Parameters<AdminRolesAccessService["createAction"]>) {
    return this.rolesAccessService.createAction(...args);
  }

  async updateAction(...args: Parameters<AdminRolesAccessService["updateAction"]>) {
    return this.rolesAccessService.updateAction(...args);
  }

  async deactivateAction(...args: Parameters<AdminRolesAccessService["deactivateAction"]>) {
    return this.rolesAccessService.deactivateAction(...args);
  }

  async listPermissionCategories(...args: Parameters<AdminRolesAccessService["listPermissionCategories"]>) {
    return this.rolesAccessService.listPermissionCategories(...args);
  }

  async getAccessByResource(...args: Parameters<AdminRolesAccessService["getAccessByResource"]>) {
    return this.rolesAccessService.getAccessByResource(...args);
  }

  async getAuditReport(...args: Parameters<AdminAuditSystemService["getAuditReport"]>) {
    return this.auditSystemService.getAuditReport(...args);
  }

  async exportAuditReportCsv(...args: Parameters<AdminAuditSystemService["exportAuditReportCsv"]>) {
    return this.auditSystemService.exportAuditReportCsv(...args);
  }

  async createDatabaseBackup(...args: Parameters<AdminDatabaseBackupService["createDatabaseBackup"]>) {
    return this.databaseBackupService.createDatabaseBackup(...args);
  }

  async getSystemStatus(...args: Parameters<AdminAuditSystemService["getSystemStatus"]>) {
    return this.auditSystemService.getSystemStatus(...args);
  }

  async checkSystemStatus(...args: Parameters<AdminAuditSystemService["checkSystemStatus"]>) {
    return this.auditSystemService.checkSystemStatus(...args);
  }

  async listCodeCatalogs(...args: Parameters<AdminCatalogsSettingsOverviewService["listCodeCatalogs"]>) {
    return this.catalogsSettingsOverviewService.listCodeCatalogs(...args);
  }

  async createCodeCatalog(...args: Parameters<AdminCatalogsSettingsOverviewService["createCodeCatalog"]>) {
    return this.catalogsSettingsOverviewService.createCodeCatalog(...args);
  }

  async updateCodeCatalog(...args: Parameters<AdminCatalogsSettingsOverviewService["updateCodeCatalog"]>) {
    return this.catalogsSettingsOverviewService.updateCodeCatalog(...args);
  }

  async deactivateCodeCatalog(...args: Parameters<AdminCatalogsSettingsOverviewService["deactivateCodeCatalog"]>) {
    return this.catalogsSettingsOverviewService.deactivateCodeCatalog(...args);
  }

  async getFrontendSettings(...args: Parameters<AdminCatalogsSettingsOverviewService["getFrontendSettings"]>) {
    return this.catalogsSettingsOverviewService.getFrontendSettings(...args);
  }

  async updateFrontendSettings(...args: Parameters<AdminCatalogsSettingsOverviewService["updateFrontendSettings"]>) {
    return this.catalogsSettingsOverviewService.updateFrontendSettings(...args);
  }

  async resetFrontendSettings(...args: Parameters<AdminCatalogsSettingsOverviewService["resetFrontendSettings"]>) {
    return this.catalogsSettingsOverviewService.resetFrontendSettings(...args);
  }

  async getOverview(...args: Parameters<AdminCatalogsSettingsOverviewService["getOverview"]>) {
    return this.catalogsSettingsOverviewService.getOverview(...args);
  }

  async backfillProjectGeneralChannels(
    ...args: Parameters<AdminCatalogsSettingsOverviewService["backfillProjectGeneralChannels"]>
  ) {
    return this.catalogsSettingsOverviewService.backfillProjectGeneralChannels(...args);
  }
}
