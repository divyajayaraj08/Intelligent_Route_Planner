class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    this.items.push({ element, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    if (this.isEmpty()) return null;
    return this.items.shift().element;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

module.exports = PriorityQueue;
