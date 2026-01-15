
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    return new PrismaClient()
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// In development, clear the global instance to force reload after schema changes
if (process.env.NODE_ENV !== 'production') {
    const prismaAny = globalThis.prismaGlobal as any;
    const hasCampSiteModel = !!prismaAny?.campSite;
    const hasTeamMemberModel = !!prismaAny?.campSiteTeamMember;

    // Clear old instance if it doesn't have newer models after schema changes
    if (!globalThis.prismaGlobal || !hasCampSiteModel || !hasTeamMemberModel) {
        globalThis.prismaGlobal = undefined;
    }
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
