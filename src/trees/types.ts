export interface TreeNode {
  name: string;
  path: string;
  isLeaf: boolean;
  pageName?: string;
  canonicalPage?: boolean;
  virtual?: boolean;
  modifiedAt?: number;
  children?: TreeNode[];
}
