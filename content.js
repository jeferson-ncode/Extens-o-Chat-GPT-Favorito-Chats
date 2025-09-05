class ChatGPTFavorites {
  constructor() {
    this.currentChatId = null;
    this.favorites = [];
    this.init();
  }

  async init() {
    await this.loadFavorites();
    this.observeUrlChanges();
    this.observeSidebar();
    this.checkCurrentPage();
  }

  async loadFavorites() {
    try {
      const result = await chrome.storage.local.get(["chatgpt_favorites"]);
      this.favorites = result.chatgpt_favorites || [];
    } catch (error) {
      console.error("Erro ao carregar favoritos:", error);
      this.favorites = [];
    }
  }

  async saveFavorites() {
    try {
      await chrome.storage.local.set({ chatgpt_favorites: this.favorites });
    } catch (error) {
      console.error("Erro ao salvar favoritos:", error);
    }
  }

  observeUrlChanges() {
    let currentUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        setTimeout(() => this.checkCurrentPage(), 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  observeSidebar() {
    const sidebar = document.querySelector("aside");
    if (!sidebar) return;

    const observer = new MutationObserver(() => {
      this.injectFavoritesList();
    });
    observer.observe(sidebar, { childList: true, subtree: true });
  }

  checkCurrentPage() {
    const url = window.location.href;
    if (url.includes("/c/")) {
      this.extractChatId();
      this.injectFavoriteButton();
    }
    this.injectFavoritesList();
  }

  extractChatId() {
    const match = window.location.pathname.match(/\/c\/([^\/]+)/);
    this.currentChatId = match ? match[1] : null;
  }

  getCurrentChatTitle() {
    const titleSelectors = [
      "h1",
      '[data-testid="conversation-title"]',
      ".text-xl.font-semibold",
      ".overflow-hidden.text-ellipsis.whitespace-nowrap",
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    const h1Elements = document.querySelectorAll("h1, .font-semibold");
    for (const element of h1Elements) {
      const text = element.textContent.trim();
      if (text && text !== "ChatGPT" && !text.includes("OpenAI")) {
        return text;
      }
    }

    return `Chat ${this.currentChatId?.substring(0, 8) || "Unknown"}`;
  }

  injectFavoriteButton() {
    if (!this.currentChatId) return;

    const existingButton = document.querySelector("#favorite-chat-button");
    if (existingButton) existingButton.remove();

    const shareButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent.trim() === "Compartilhar"
    );

    if (!shareButton) return;

    const isFavorited = this.favorites.some((fav) => fav.id === this.currentChatId);

    const button = document.createElement("button");
    button.id = "favorite-chat-button";
    button.className = "favorite-button";
    button.innerHTML = isFavorited ? "★" : "☆";
    button.title = isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos";

    button.addEventListener("click", () => this.toggleFavorite());

    shareButton.parentNode.insertBefore(button, shareButton);
  }

  async toggleFavorite() {
    if (!this.currentChatId) return;

    const existingIndex = this.favorites.findIndex((fav) => fav.id === this.currentChatId);

    if (existingIndex !== -1) {
      this.favorites.splice(existingIndex, 1);
      this.showNotification("Chat removido dos favoritos!");
    } else {
      const title = this.getCurrentChatTitle();
      const favorite = {
        id: this.currentChatId,
        title: title,
        url: window.location.href,
        dateAdded: new Date().toISOString(),
      };
      this.favorites.unshift(favorite);
      this.showNotification("Chat adicionado aos favoritos!");
    }

    this.injectFavoritesList();
    await this.saveFavorites();
    this.updateFavoriteButton();
  }

  updateFavoriteButton() {
    const button = document.querySelector("#favorite-chat-button");
    if (!button) return;

    const isFavorited = this.favorites.some((fav) => fav.id === this.currentChatId);
    button.innerHTML = isFavorited ? "★" : "☆";
    button.title = isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos";
  }

  injectFavoritesList() {
    if (this.favorites.length === 0) return;

    this.waitForChatsHeader((chatsHeader) => {
      const existingList = document.querySelector("#favorites-list-container");
      if (existingList) existingList.remove();

      const container = document.createElement("div");
      container.id = "favorites-list-container";
      container.className = "favorites-container";
      container.style.marginBottom = "10px";

      const title = document.createElement("h2");
      title.textContent = "★ Favoritos";
      title.className = "favorite-label";
      container.appendChild(title);

      const list = document.createElement("div");
      list.className = "favorites-list";

      this.favorites.forEach((fav, index) => {
        list.appendChild(this.createFavoriteCard(fav, index));
      });

      container.appendChild(list);
      chatsHeader.parentNode.insertBefore(container, chatsHeader);
    });
  }

  waitForChatsHeader(callback) {
    const observer = new MutationObserver(() => {
      const chatsHeader = Array.from(document.querySelectorAll("h2.__menu-label")).find(
        (h2) => h2.textContent.trim() === "Chats"
      );
      if (chatsHeader) {
        observer.disconnect();
        callback(chatsHeader);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  createFavoriteCard(favorite, index) {
    const card = document.createElement("div");
    card.className = "favorite-card";

    const dropdown = document.createElement("div");
    dropdown.className = "favorite-dropdown";

    const button = document.createElement("button");
    button.textContent = favorite.title;
    button.className = "favorite-dropdown-btn";

    const menu = document.createElement("div");
    menu.className = "favorite-dropdown-menu";
    menu.style.display = "none";
    menu.innerHTML = `
      <a href="${favorite.url}" class="favorite-link">Abrir Chat</a>
      <button class="favorite-rename" data-index="${index}">Renomear</button>
      <button class="favorite-remove" data-index="${index}">Remover</button>
    `;

    button.addEventListener("click", () => {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    });

    dropdown.appendChild(button);
    dropdown.appendChild(menu);
    card.appendChild(dropdown);

    menu.querySelector(".favorite-remove").addEventListener("click", (e) => {
      e.preventDefault();
      this.removeFavorite(index);
    });

    menu.querySelector(".favorite-rename").addEventListener("click", (e) => {
      e.preventDefault();
      this.renameFavorite(index);
    });

    return card;
  }

  async renameFavorite(index) {
    const favorite = this.favorites[index];
    if (!favorite) return;

    const newName = prompt("Digite o novo nome do favorito:", favorite.title);
    if (newName && newName.trim() !== favorite.title) {
      this.favorites[index].title = newName.trim();
      this.injectFavoritesList();
      this.saveFavorites();
      this.showNotification(`Favorito renomeado para "${newName}"`);
    }
  }

  async removeFavorite(index) {
    this.favorites.splice(index, 1);
    this.injectFavoritesList();
    await this.saveFavorites();
    this.showNotification("Favorito removido!");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message) {
    const existing = document.querySelector("#chatgpt-favorites-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "chatgpt-favorites-notification";
    notification.className = "favorites-notification";
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add("show"), 100);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
      }, 300);
    }, 3000);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ChatGPTFavorites();
  });
} else {
  new ChatGPTFavorites();
}
