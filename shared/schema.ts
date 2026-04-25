import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  title: text("title"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  location: text("location"),
  // Social links stored as JSON text
  socialLinks: text("social_links").default("[]"),
  // Company association
  companyId: integer("company_id"),
  companyName: text("company_name"),
  companyRole: text("company_role"),
  // Website
  website: text("website"),
  // Tags for searchability
  tags: text("tags").default("[]"),
  // Source metadata
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  githubUrl: text("github_url"),
  instagramUrl: text("instagram_url"),
  // Status
  isVerified: integer("is_verified", { mode: "boolean" }).default(false),
  createdAt: integer("created_at").default(0),
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  website: text("website"),
  industry: text("industry"),
  location: text("location"),
  foundedYear: integer("founded_year"),
  size: text("size"),
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  socialLinks: text("social_links").default("[]"),
  createdAt: integer("created_at").default(0),
});

// Insert schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Suggestion type for AI-returned results
export type ContactSuggestion = {
  name: string;
  title?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  companyName?: string;
  companyRole?: string;
  website?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  tags?: string[];
  confidence: number; // 0-1
  source: string;
  reason: string; // Why this person is likely at NovaNEXT Portugal 2026
};
