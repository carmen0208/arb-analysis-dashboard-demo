import { describe, it, expect, beforeAll } from "vitest";
import {
  createTestOctokit,
  testRepoOwner,
  testRepoName,
  getYesterday,
} from "../setup";
import {
  getRecentCommits,
  getCommit,
} from "../../../src/github/services/commits";
import { Octokit } from "@octokit/rest";

describe("GitHub Commits API Integration", () => {
  let octokit: Octokit;

  beforeAll(() => {
    octokit = createTestOctokit();
  });

  describe("getRecentCommits", () => {
    it("should fetch recent commits from the test repository", async () => {
      const commits = await getRecentCommits({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
      });

      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeGreaterThan(0);

      const firstCommit = commits[0];
      expect(firstCommit).toMatchObject({
        sha: expect.any(String),
        commit: {
          message: expect.any(String),
          author: {
            name: expect.any(String),
            email: expect.any(String),
            date: expect.any(String),
          },
        },
        html_url: expect.any(String),
      });
    });

    it("should respect perPage option", async () => {
      const perPage = 5;
      const commits = await getRecentCommits({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        options: { perPage },
      });

      expect(commits.length).toBeLessThanOrEqual(perPage);
    });

    it("should filter commits by path", async () => {
      const path = "README.md";
      const commits = await getRecentCommits({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        options: { path },
      });

      expect(Array.isArray(commits)).toBe(true);
      // Note: This test might fail if README.md has no commits
      // You might want to use a different file path that you know exists
      expect(commits.length).toBeGreaterThan(0);
    });

    it("should filter commits by since", async () => {
      const sinceDate = getYesterday();
      const commits = await getRecentCommits({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        options: { sinceDate },
      });
      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeGreaterThan(0);
    });
  });

  describe("getCommit", () => {
    it("should fetch a specific commit by SHA", async () => {
      // First get a valid commit SHA from recent commits
      const recentCommits = await getRecentCommits({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        options: { perPage: 1 },
      });

      const sha = recentCommits[0].sha;
      const commit = await getCommit({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        sha,
      });

      expect(commit).toMatchObject({
        sha: sha,
        commit: {
          message: expect.any(String),
          author: {
            name: expect.any(String),
            email: expect.any(String),
            date: expect.any(String),
          },
        },
        html_url: expect.any(String),
      });
    });

    it("should throw an error for non-existent commit SHA", async () => {
      const nonExistentSHA = "0".repeat(40); // Invalid SHA

      await expect(
        getCommit({
          octokit,
          owner: testRepoOwner,
          repo: testRepoName,
          sha: nonExistentSHA,
        }),
      ).rejects.toThrow();
    });
  });
});
