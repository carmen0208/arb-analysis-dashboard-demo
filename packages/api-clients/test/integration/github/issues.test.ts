import { describe, it, expect, beforeAll } from "vitest";
import { createTestOctokit, testRepoOwner, testRepoName } from "../setup";
import {
  getGoodFirstIssues,
  getHelpWantedIssues,
  getIssue,
} from "../../../src/github";
import { Octokit } from "@octokit/rest";

describe("GitHub Issues API Integration", () => {
  let octokit: Octokit;

  beforeAll(() => {
    octokit = createTestOctokit();
  });

  describe("getGoodFirstIssues", () => {
    it("should fetch good first issues from the test repository", async () => {
      const issues = await getGoodFirstIssues(
        octokit,
        testRepoOwner,
        testRepoName,
      );

      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(issues[0]).toMatchObject({
          title: expect.any(String),
          number: expect.any(Number),
          html_url: expect.any(String),
          labels: expect.arrayContaining([
            expect.objectContaining({
              name: "good first issue",
            }),
          ]),
        });
      }
    });
  });

  describe("getHelpWantedIssues", () => {
    it("should fetch help wanted issues from the test repository", async () => {
      const issues = await getHelpWantedIssues(
        octokit,
        testRepoOwner,
        testRepoName,
      );

      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(issues[0]).toMatchObject({
          title: expect.any(String),
          number: expect.any(Number),
          html_url: expect.any(String),
          labels: expect.arrayContaining([
            expect.objectContaining({
              name: "help wanted",
            }),
          ]),
        });
      }
    });
  });

  describe("getIssue", () => {
    it("should fetch a specific issue by number", async () => {
      // Note: Replace 1 with an actual issue number that exists in your test repo
      const issueNumber = 1;
      const issue = await getIssue(
        octokit,
        testRepoOwner,
        testRepoName,
        issueNumber,
      );

      expect(issue).toMatchObject({
        number: issueNumber,
        title: expect.any(String),
        html_url: expect.any(String),
        state: expect.stringMatching(/^(open|closed)$/),
        body: expect.any(String),
      });
    });

    it("should throw an error for non-existent issue", async () => {
      const nonExistentIssueNumber = 999999;

      await expect(
        getIssue(octokit, testRepoOwner, testRepoName, nonExistentIssueNumber),
      ).rejects.toThrow();
    });
  });
});
