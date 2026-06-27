-- CreateIndex
CREATE INDEX "CampSite_isPublished_deletedAt_avgRating_id_idx" ON "CampSite"("isPublished", "deletedAt", "avgRating", "id");
