-- CreateIndex
CREATE INDEX "CampSite_isPublished_deletedAt_priceLow_id_idx" ON "CampSite"("isPublished", "deletedAt", "priceLow", "id");

-- CreateIndex
CREATE INDEX "CampSite_isPublished_deletedAt_createdAt_id_idx" ON "CampSite"("isPublished", "deletedAt", "createdAt", "id");
