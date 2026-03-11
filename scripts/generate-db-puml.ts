import fs from "node:fs";
import path from "node:path";

type ModelField = {
  name: string;
  type: string;
  isRelation: boolean;
  hasForeignKey: boolean;
  fkFields: string[];
  targetModel?: string;
};

type ParsedModel = {
  name: string;
  fields: ModelField[];
};

const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repoRoot, "apps/api/prisma/schema.prisma");
const outputDir = path.join(repoRoot, "docs/db/puml");

const DOMAIN_MAP: Record<string, string[]> = {
  rbac: ["Role", "Permission", "PermissionCategory", "RolePermission", "User", "ProjectMember", "InternalInvite"],
  "projects-tasks": ["Project", "ProjectMember", "ProjectTeamLink", "ProjectStage", "Task", "TaskDependency", "TaskStatusHistory", "TaskReassignment", "TaskScheduleHistory", "Objective", "ObjectiveTask"],
  "meetings-messaging": ["Meeting", "MeetingParticipant", "MeetingAgendaItem", "MeetingNote", "MeetingAgreement", "Channel", "ChannelMember", "Message", "MessageAttachment", "Notification", "NotificationPreference"],
  "documents-files": ["Folder", "FileObject", "FileTrash", "ProjectDocumentSpace", "CollaborativeDocument", "CollaborativeDocumentVersion", "DocumentAsset", "StorageQuota"],
  "admin-audit-integrations": ["AuditLog", "WebhookEndpoint", "WebhookDelivery", "FormRequest", "AutomationRule", "DecisionNote", "GuestInvite", "ImportJob", "ImportError", "MaintenanceMode", "FrontendSettings"]
};

function parseSchema(content: string): ParsedModel[] {
  const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g;
  const models: ParsedModel[] = [];

  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(content)) !== null) {
    const [, modelName, body] = match;
    const rawLines = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("@@") && !line.startsWith("//"));

    const fields: ModelField[] = [];
    for (const line of rawLines) {
      if (line.startsWith("@")) {
        continue;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        continue;
      }
      const name = parts[0];
      const type = parts[1];
      const relationMatch = line.match(/@relation\(([^)]*)\)/);
      const hasForeignKey = Boolean(relationMatch && /fields:\s*\[/.test(relationMatch[1] ?? ""));
      const fkFieldsMatch = (relationMatch?.[1] ?? "").match(/fields:\s*\[([^\]]+)\]/);
      const fkFields = fkFieldsMatch
        ? fkFieldsMatch[1]
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [];
      fields.push({
        name,
        type,
        isRelation: Boolean(relationMatch),
        hasForeignKey,
        fkFields
      });
    }

    models.push({ name: modelName, fields });
  }

  const modelNames = new Set(models.map((model) => model.name));
  for (const model of models) {
    for (const field of model.fields) {
      const normalized = field.type.replace(/[\[\]?]/g, "");
      if (modelNames.has(normalized)) {
        field.targetModel = normalized;
      }
    }
  }

  return models;
}

function renderPlantUml(models: ParsedModel[], filename: string, includedModels?: Set<string>) {
  const selectedModels = includedModels
    ? models.filter((model) => includedModels.has(model.name))
    : models;
  const selectedModelNames = new Set(selectedModels.map((model) => model.name));

  const lines: string[] = [
    "@startuml",
    "hide circle",
    "skinparam linetype ortho",
    "skinparam classAttributeIconSize 0",
    ""
  ];

  for (const model of selectedModels) {
    lines.push(`entity "${model.name}" as ${model.name} {`);
    for (const field of model.fields) {
      if (field.targetModel && field.isRelation) {
        continue;
      }
      const marker = field.name === "id" ? "*" : " ";
      lines.push(`  ${marker} ${field.name}: ${field.type}`);
    }
    lines.push("}");
    lines.push("");
  }

  const relationSet = new Set<string>();
  for (const model of selectedModels) {
    for (const field of model.fields) {
      if (!field.hasForeignKey || !field.targetModel) {
        continue;
      }
      if (!selectedModelNames.has(field.targetModel)) {
        continue;
      }
      const fkLabel = field.fkFields.length > 0 ? ` : ${field.fkFields.join(", ")}` : "";
      const signature = `${model.name}->${field.targetModel}:${field.fkFields.join(",")}`;
      if (relationSet.has(signature)) {
        continue;
      }
      relationSet.add(signature);
      lines.push(`${model.name} }o--|| ${field.targetModel}${fkLabel}`);
    }
  }

  lines.push("");
  lines.push("@enduml");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, filename), `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const models = parseSchema(schema);

  renderPlantUml(models, "corelia-global.puml");
  for (const [domain, modelNames] of Object.entries(DOMAIN_MAP)) {
    renderPlantUml(models, `corelia-${domain}.puml`, new Set(modelNames));
  }

  // Remove stale files from previous runs.
  const validFiles = new Set([
    "corelia-global.puml",
    ...Object.keys(DOMAIN_MAP).map((domain) => `corelia-${domain}.puml`)
  ]);
  for (const file of fs.readdirSync(outputDir)) {
    if (file.endsWith(".puml") && !validFiles.has(file)) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }

  console.log(`PUML generado en ${path.relative(repoRoot, outputDir)}`);
}

main();
