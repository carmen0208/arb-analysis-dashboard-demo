import { describe, it, expect, beforeAll } from "vitest";
import { createTestOctokit, testRepoOwner, testRepoName } from "../setup";
import { getPullRequest, getRecentPullRequests } from "../../../src/github";
import { Octokit } from "@octokit/rest";

describe("GitHub Pull Requests API Integration", () => {
  let octokit: Octokit;

  beforeAll(() => {
    octokit = createTestOctokit();
  });

  describe("getRecentPullRequests", () => {
    it("should fetch recent pull requests with default options", async () => {
      const prs = await getRecentPullRequests({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
      });

      expect(Array.isArray(prs)).toBe(true);
      if (prs.length > 0) {
        expect(prs[0]).toMatchObject({
          number: expect.any(Number),
          title: expect.any(String),
          body: expect.any(String) || null,
          html_url: expect.any(String),
          state: expect.stringMatching(/^(open|closed)$/),
          files: expect.any(Array),
          diff: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });
      }
    });

    it("should fetch closed pull requests when specified", async () => {
      const prs = await getRecentPullRequests({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        options: {
          state: "closed",
          perPage: 5,
        },
      });

      expect(Array.isArray(prs)).toBe(true);
      if (prs.length > 0) {
        expect(prs[0].state).toBe("closed");
      }
    });
  });

  describe("getPullRequest", () => {
    it("should fetch a specific pull request by number", async () => {
      // First get a valid PR number from recent PRs
      const recentPRs = await getRecentPullRequests({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        options: { perPage: 1 },
      });

      if (recentPRs.length === 0) {
        console.warn("No pull requests found in test repository");
        return;
      }

      const pullNumber = recentPRs[0].number;
      const pr = await getPullRequest({
        octokit,
        owner: testRepoOwner,
        repo: testRepoName,
        pullNumber,
      });

      expect(pr).toMatchObject({
        number: pullNumber,
        title: expect.any(String),
        body: expect.any(String) || null,
        html_url: expect.any(String),
        state: expect.stringMatching(/^(open|closed)$/),
        files: expect.any(Array),
        diff: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it("should throw an error for non-existent pull request", async () => {
      const nonExistentPRNumber = 999999;

      await expect(
        getPullRequest({
          octokit,
          owner: testRepoOwner,
          repo: testRepoName,
          pullNumber: nonExistentPRNumber,
        }),
      ).rejects.toThrow();
    });
  });
});
