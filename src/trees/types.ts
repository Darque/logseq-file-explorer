export interface TreeNode {
  name: string;
  path: string;
  isLeaf: boolean;
  pageName?: string;
  canonicalPage?: boolean;
  virtual?: boolean;
  children?: TreeNode[];
}
