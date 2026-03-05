import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const run = async () => {
  const dryRun = !process.argv.includes("--apply");

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      ownerId: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const projectIds = projects.map((project) => project.id);
  const [projectMembers, projectChannels] = await Promise.all([
    projectIds.length
      ? prisma.projectMember.findMany({
          where: {
            projectId: {
              in: projectIds
            }
          },
          select: {
            projectId: true,
            userId: true
          }
        })
      : [],
    projectIds.length
      ? prisma.channel.findMany({
          where: {
            scope: "PROYECTO",
            projectId: {
              in: projectIds
            }
          },
          include: {
            members: {
              select: {
                userId: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        })
      : []
  ]);

  const membersByProject = new Map<string, Set<string>>();
  for (const project of projects) {
    membersByProject.set(project.id, new Set([project.ownerId]));
  }
  for (const member of projectMembers) {
    const set = membersByProject.get(member.projectId) ?? new Set<string>();
    set.add(member.userId);
    membersByProject.set(member.projectId, set);
  }

  const channelsByProject = new Map<string, typeof projectChannels>();
  for (const channel of projectChannels) {
    if (!channel.projectId) {
      continue;
    }
    const list = channelsByProject.get(channel.projectId) ?? [];
    list.push(channel);
    channelsByProject.set(channel.projectId, list);
  }

  let channelsCreated = 0;
  let membershipsInserted = 0;

  for (const project of projects) {
    const memberIds = [...(membersByProject.get(project.id) ?? new Set<string>([project.ownerId]))];
    const candidates = channelsByProject.get(project.id) ?? [];
    const selected = candidates.find((channel) => /general/i.test(channel.name)) ?? candidates[0] ?? null;

    if (!selected) {
      channelsCreated += 1;
      membershipsInserted += memberIds.length;

      if (dryRun) {
        continue;
      }

      await prisma.channel.create({
        data: {
          name: `${project.name} · General`.slice(0, 120),
          scope: "PROYECTO",
          projectId: project.id,
          members: {
            create: memberIds.map((userId) => ({ userId }))
          }
        }
      });
      continue;
    }

    const existingMemberIds = new Set(selected.members.map((member) => member.userId));
    const missingMemberIds = memberIds.filter((userId) => !existingMemberIds.has(userId));
    membershipsInserted += missingMemberIds.length;

    if (dryRun || missingMemberIds.length === 0) {
      continue;
    }

    await prisma.channelMember.createMany({
      data: missingMemberIds.map((userId) => ({
        channelId: selected.id,
        userId
      })),
      skipDuplicates: true
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        projectsScanned: projects.length,
        channelsCreated,
        membershipsInserted
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
