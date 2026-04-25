import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, like, or } from "drizzle-orm";
import { contacts, companies, type Contact, type Company, type InsertContact, type InsertCompany } from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

// Create tables if not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT,
    bio TEXT,
    avatar_url TEXT,
    location TEXT,
    social_links TEXT DEFAULT '[]',
    company_id INTEGER,
    company_name TEXT,
    company_role TEXT,
    website TEXT,
    tags TEXT DEFAULT '[]',
    linkedin_url TEXT,
    twitter_url TEXT,
    github_url TEXT,
    instagram_url TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    industry TEXT,
    location TEXT,
    founded_year INTEGER,
    size TEXT,
    linkedin_url TEXT,
    twitter_url TEXT,
    social_links TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT 0
  );
`);

function slugify(text: string): string {
  return text
    .normalize('NFD')                        // decompose: é → e + ́
    .replace(/[\u0300-\u036f]/g, '')          // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Migration: fix broken slugs from pre-NFD slugify (runs once on startup)
(function fixBrokenSlugs() {
  try {
    const rows = sqlite.prepare('SELECT id, name, slug FROM contacts').all() as { id: number; name: string; slug: string }[];
    for (const row of rows) {
      const correct = slugify(row.name);
      if (correct !== row.slug) {
        // Check no collision first
        const collision = sqlite.prepare('SELECT id FROM contacts WHERE slug = ? AND id != ?').get(correct, row.id);
        if (!collision) {
          sqlite.prepare('UPDATE contacts SET slug = ? WHERE id = ?').run(correct, row.id);
          console.log(`[migration] fixed slug: ${row.slug} → ${correct}`);
        }
      }
    }
  } catch (e) {
    // Non-fatal
  }
})();

function uniqueSlug(base: string, existing: string[]): string {
  let slug = slugify(base);
  let counter = 1;
  while (existing.includes(slug)) {
    slug = `${slugify(base)}-${counter}`;
    counter++;
  }
  return slug;
}

export interface IStorage {
  // Contacts
  getAllContacts(): Contact[];
  getContact(id: number): Contact | undefined;
  getContactBySlug(slug: string): Contact | undefined;
  searchContacts(query: string): Contact[];
  createContact(data: InsertContact): Contact;
  updateContact(id: number, data: Partial<InsertContact>): Contact | undefined;
  deleteContact(id: number): boolean;

  // Companies
  getAllCompanies(): Company[];
  getCompany(id: number): Company | undefined;
  createCompany(data: InsertCompany): Company;
  updateCompany(id: number, data: Partial<InsertCompany>): Company | undefined;
  deleteCompany(id: number): boolean;
}

export const storage: IStorage = {
  getAllContacts(): Contact[] {
    return db.select().from(contacts).all();
  },

  getContact(id: number): Contact | undefined {
    return db.select().from(contacts).where(eq(contacts.id, id)).get();
  },

  getContactBySlug(slug: string): Contact | undefined {
    return db.select().from(contacts).where(eq(contacts.slug, slug)).get();
  },

  searchContacts(query: string): Contact[] {
    const q = `%${query}%`;
    return db.select().from(contacts).where(
      or(
        like(contacts.name, q),
        like(contacts.companyName, q),
        like(contacts.title, q),
        like(contacts.bio, q),
        like(contacts.tags, q)
      )
    ).all();
  },

  createContact(data: InsertContact): Contact {
    const existing = db.select().from(contacts).all().map(c => c.slug);
    const slug = uniqueSlug(data.name, existing);
    const now = Math.floor(Date.now() / 1000);
    return db.insert(contacts).values({ ...data, slug, createdAt: now }).returning().get();
  },

  updateContact(id: number, data: Partial<InsertContact>): Contact | undefined {
    db.update(contacts).set(data).where(eq(contacts.id, id)).run();
    return db.select().from(contacts).where(eq(contacts.id, id)).get();
  },

  deleteContact(id: number): boolean {
    const result = db.delete(contacts).where(eq(contacts.id, id)).run();
    return result.changes > 0;
  },

  getAllCompanies(): Company[] {
    return db.select().from(companies).all();
  },

  getCompany(id: number): Company | undefined {
    return db.select().from(companies).where(eq(companies.id, id)).get();
  },

  createCompany(data: InsertCompany): Company {
    const existing = db.select().from(companies).all().map(c => c.slug);
    const slug = uniqueSlug(data.name, existing);
    const now = Math.floor(Date.now() / 1000);
    return db.insert(companies).values({ ...data, slug, createdAt: now }).returning().get();
  },

  updateCompany(id: number, data: Partial<InsertCompany>): Company | undefined {
    db.update(companies).set(data).where(eq(companies.id, id)).run();
    return db.select().from(companies).where(eq(companies.id, id)).get();
  },

  deleteCompany(id: number): boolean {
    const result = db.delete(companies).where(eq(companies.id, id)).run();
    return result.changes > 0;
  },
};
