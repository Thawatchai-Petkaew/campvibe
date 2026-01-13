import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type'); // 'province' | 'district'
    const provinceCode = searchParams.get('provinceCode');

    try {
        const queryPattern = `%${query || ''}%`;

        // Check if model exists on client
        if ((prisma as any).thailandLocation) {
            if (type === 'province') {
                const results = await prisma.thailandLocation.findMany({
                    where: {
                        districtCode: "",
                        OR: [
                            { provinceName: { contains: query || '', mode: 'insensitive' } },
                            { provinceNameEn: { contains: query || '', mode: 'insensitive' } }
                        ]
                    },
                    orderBy: { provinceNameEn: 'asc' },
                    take: 20
                });
                return NextResponse.json(results);
            }

            if (type === 'district') {
                const results = await prisma.thailandLocation.findMany({
                    where: {
                        provinceCode: provinceCode || undefined,
                        districtCode: { not: "" },
                        OR: [
                            { districtName: { contains: query || '', mode: 'insensitive' } },
                            { districtNameEn: { contains: query || '', mode: 'insensitive' } }
                        ]
                    },
                    orderBy: { districtNameEn: 'asc' },
                    take: 20
                });
                return NextResponse.json(results);
            }

            const results = await prisma.thailandLocation.findMany({
                where: {
                    OR: [
                        { provinceName: { contains: query || '', mode: 'insensitive' } },
                        { provinceNameEn: { contains: query || '', mode: 'insensitive' } },
                        { districtName: { contains: query || '', mode: 'insensitive' } },
                        { districtNameEn: { contains: query || '', mode: 'insensitive' } }
                    ]
                },
                orderBy: [
                    { provinceNameEn: 'asc' },
                    { districtNameEn: 'asc' }
                ],
                take: 20
            });
            return NextResponse.json(results);
        } else {
            // Fallback for stale Prisma client
            console.log('⚠️ Model thailandLocation missing, using $queryRaw fallback');
            let results: any[] = [];

            if (type === 'province') {
                results = await prisma.$queryRaw`
                    SELECT * FROM "ThailandLocation" 
                    WHERE "districtCode" = '' 
                    AND ("provinceName" ILIKE ${queryPattern} OR "provinceNameEn" ILIKE ${queryPattern})
                    ORDER BY "provinceNameEn" ASC 
                    LIMIT 20
                `;
            } else if (type === 'district') {
                results = await prisma.$queryRaw`
                    SELECT * FROM "ThailandLocation" 
                    WHERE "districtCode" != '' 
                    AND ("provinceCode" = ${provinceCode} OR ${!provinceCode})
                    AND ("districtName" ILIKE ${queryPattern} OR "districtNameEn" ILIKE ${queryPattern})
                    ORDER BY "districtNameEn" ASC 
                    LIMIT 20
                `;
            } else {
                results = await prisma.$queryRaw`
                    SELECT * FROM "ThailandLocation" 
                    WHERE "provinceName" ILIKE ${queryPattern} 
                    OR "provinceNameEn" ILIKE ${queryPattern} 
                    OR "districtName" ILIKE ${queryPattern} 
                    OR "districtNameEn" ILIKE ${queryPattern}
                    ORDER BY "provinceNameEn" ASC, "districtNameEn" ASC 
                    LIMIT 20
                `;
            }
            return NextResponse.json(results);
        }
    } catch (error: any) {
        console.error('Location search error:', error);
        return NextResponse.json({
            error: 'Failed to fetch locations',
            detail: error.message
        }, { status: 500 });
    }
}
