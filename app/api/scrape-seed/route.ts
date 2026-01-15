import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

async function fetchWithRetry(url: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (response.ok) return await response.text();
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error(`Failed to fetch ${url}`);
}

async function downloadImage(url: string, destFolder: string, fileName: string) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = path.join(destFolder, fileName);
        fs.writeFileSync(filePath, buffer);
        return true;
    } catch (error) {
        console.error(`Error downloading image ${url}:`, error);
        return false;
    }
}

function slugify(text: string) {
    return text.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function POST() {
    try {
        console.log("Starting real-data scrape with local image download...");

        // 1. Get List Page
        const listHtml = await fetchWithRetry('https://what-the-camp.com/camps');
        const $list = cheerio.load(listHtml);

        const campgroundUrls: string[] = [];
        $list('.result_zone_scroll .card').each((i: number, el: any) => {
            if (campgroundUrls.length < 5) {
                const url = $list(el).find('a').first().attr('href');
                if (url && url.startsWith('http')) {
                    campgroundUrls.push(url);
                }
            }
        });

        console.log(`Found ${campgroundUrls.length} URLs to scrape.`);

        // 2. Clear existing data
        await prisma.booking.deleteMany();
        await prisma.review.deleteMany();
        await prisma.spot.deleteMany();
        await prisma.campSite.deleteMany();
        await prisma.location.deleteMany();

        const operator = await prisma.user.upsert({
            where: { email: 'operator@campvibe.com' },
            update: {},
            create: {
                email: 'operator@campvibe.com',
                name: 'Main Operator',
                role: 'OPERATOR',
            },
        });

        const results = [];

        // 3. Scrape and Seed
        for (const url of campgroundUrls) {
            console.log(`Scraping: ${url}`);
            const detailHtml = await fetchWithRetry(url);
            const $detail = cheerio.load(detailHtml);

            // Extract Name (usually in a specific container)
            const nameTh = $detail('h1').first().text().trim() || "Unknown Camp";
            const nameThSlug = slugify(nameTh) + '-' + Math.floor(Math.random() * 1000);

            // Extract Description
            const description = $detail('.camp-detail__description').text().trim() || "No description provided.";

            // Extract Remote Image URLs
            const remoteImages: string[] = [];

            // Try selector first
            $detail('.camps_detail_page_image_slick img').each((i, el) => {
                const src = $detail(el).attr('src') || $detail(el).attr('data-src');
                if (src && (src.includes('whatthecamp.b-cdn.net') || src.includes('what-the-camp.com'))) {
                    if (!remoteImages.includes(src)) remoteImages.push(src);
                }
            });

            // Regex fallback if selector fails
            if (remoteImages.length === 0) {
                const imgMatches = detailHtml.match(/https?:\/\/(?:whatthecamp\.b-cdn\.net|what-the-camp\.com)\/imgs\/camps-[^"' >]+/g);
                if (imgMatches) {
                    imgMatches.forEach(img => {
                        if (!remoteImages.includes(img)) remoteImages.push(img);
                    });
                }
            }

            // --- LOCAL IMAGE DOWNLOAD ---
            const localFolder = path.join(process.cwd(), 'public', 'mockup', 'campgrounds', nameThSlug);
            if (!fs.existsSync(localFolder)) {
                fs.mkdirSync(localFolder, { recursive: true });
            }

            const localImages: string[] = [];
            const maxImages = 10; // Limit for mockup
            for (let i = 0; i < Math.min(remoteImages.length, maxImages); i++) {
                const ext = path.extname(new URL(remoteImages[i]).pathname) || '.jpg';
                const fileName = `img-${i}${ext}`;
                const success = await downloadImage(remoteImages[i], localFolder, fileName);
                if (success) {
                    localImages.push(`/mockup/campgrounds/${nameThSlug}/${fileName}`);
                }
            }
            // ----------------------------

            // Extract Price (rough parsing)
            const priceText = $detail('.camp-detail__price').text() || "500";
            const priceLow = parseInt(priceText.replace(/[^\d]/g, '')) || 300;
            const priceHigh = priceLow + 500;

            // Extract Location (rough)
            const locationText = $detail('.camp-detail__location').text().trim() || "Thailand";
            const provinceMatch = locationText.match(/จังหวัด([\u0E00-\u0E7F]+)/);
            const province = provinceMatch ? provinceMatch[1] : "Chiang Mai";

            // Create Location
            const location = await prisma.location.create({
                data: {
                    country: 'Thailand',
                    province: province,
                    lat: 13.0 + Math.random() * 5,
                    lon: 100.0 + Math.random() * 2
                }
            });

            // Create Camp Site
            const campSite = await prisma.campSite.create({
                data: {
                    nameTh,
                    nameEn: nameTh, // Backup
                    nameThSlug,
                    nameEnSlug: nameThSlug + '-en',
                    description,
                    images: localImages.join(','), // USE LOCAL PATHS
                    campSiteType: 'CAGD', // Default to basic
                    accessTypes: 'DRIV,HIKE',
                    accommodationTypes: 'TENT,CABI',
                    facilities: 'TOIL,SHOW,PARK',
                    latitude: location.lat!,
                    longitude: location.lon!,
                    checkInTime: '14:00',
                    checkOutTime: '12:00',
                    bookingMethod: 'ONLI',
                    priceLow,
                    priceHigh,
                    isActive: true,
                    isPublished: true,
                    operatorId: operator.id,
                    locationId: location.id,
                }
            });

            // Add generic spots
            await prisma.spot.create({
                data: {
                    zone: 'Zone A',
                    name: 'Spot 1',
                    maxCampers: 4,
                    pricePerNight: priceLow,
                    campSiteId: campSite.id
                }
            });

            results.push({ name: nameTh, imageCount: localImages.length });
        }

        return NextResponse.json({ success: true, count: results.length, data: results });
    } catch (error) {
        console.error("Scraper Error:", error);
        return NextResponse.json({ error: 'Scraping failed', details: String(error) }, { status: 500 });
    }
}
