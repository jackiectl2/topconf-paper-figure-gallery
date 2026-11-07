export class ReferenceSampler {
  constructor(ids, random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length < 4) throw new Error('Invalid private reference catalog');
    this.ids = [...ids];
    this.random = random;
    this.remaining = [];
  }
  refill(exclude = []) {
    const banned = new Set(exclude);
    this.remaining = this.ids.filter(id => !banned.has(id));
    for (let i = this.remaining.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
    }
  }
  draw(count) {
    if (!Number.isInteger(count) || count < 4 || count > 10 || count > this.ids.length) throw new Error('Choose 4–10 references');
    const selected = [];
    while (selected.length < count) {
      if (!this.remaining.length) this.refill(selected);
      selected.push(this.remaining.pop());
    }
    return selected;
  }
}
