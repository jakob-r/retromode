/** What a mutation touched; used to broadcast fresh, personalized state afterwards. */
export class Changes {
  board = false
  readonly itemIds = new Set<string>()
  readonly groupIds = new Set<string>()
  readonly deletedItemIds = new Set<string>()
  readonly deletedGroupIds = new Set<string>()

  boardChanged(): this {
    this.board = true
    return this
  }

  item(id: string): this {
    this.itemIds.add(id)
    return this
  }

  group(id: string): this {
    this.groupIds.add(id)
    return this
  }

  deleteItem(id: string): this {
    this.itemIds.delete(id)
    this.deletedItemIds.add(id)
    return this
  }

  deleteGroup(id: string): this {
    this.groupIds.delete(id)
    this.deletedGroupIds.add(id)
    return this
  }

  get isEmpty(): boolean {
    return (
      !this.board &&
      this.itemIds.size === 0 &&
      this.groupIds.size === 0 &&
      this.deletedItemIds.size === 0 &&
      this.deletedGroupIds.size === 0
    )
  }
}
