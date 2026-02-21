export type PullRequest = {
  id: number
  repo_owner: string
  repo_name: string
  repo_url: string
  base_branch: string
  head_branch: string
  title: string
  body: string
  compare_url: string
  created_at: string
  updated_at: string
}
