/**
 * global.js — Universal theme scripts
 * Handles common interactive components universally across all sections:
 * - Carousels & horizontal sliders with arrows
 * - Tab switchers
 * - Quick-add to cart with AJAX & cart drawer triggers
 * - Quantity selectors
 */

(function() {
  'use strict';

  // 1. Universal Carousel Component
  function initUniversalCarousels(container) {
    const scope = container || document;
    const wrappers = scope.querySelectorAll('.featured-collection__carousel-wrapper, [data-carousel]');

    wrappers.forEach(wrapper => {
      const grid = wrapper.querySelector('.featured-collection__grid, [data-carousel-grid]');
      const prevBtn = wrapper.querySelector('.featured-collection__arrow--prev, [data-carousel-prev]');
      const nextBtn = wrapper.querySelector('.featured-collection__arrow--next, [data-carousel-next]');

      if (!grid) return;

      function updateArrows() {
        if (!prevBtn || !nextBtn) return;
        const scrollLeft = grid.scrollLeft;
        const maxScroll = grid.scrollWidth - grid.clientWidth;
        prevBtn.disabled = scrollLeft <= 10;
        nextBtn.disabled = scrollLeft >= maxScroll - 10;
      }

      grid.removeEventListener('scroll', updateArrows);
      grid.addEventListener('scroll', updateArrows, { passive: true });

      if (prevBtn && !prevBtn._bound) {
        prevBtn._bound = true;
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const card = grid.querySelector('.product-card, > *');
          const cardWidth = card ? card.clientWidth : 300;
          grid.scrollBy({ left: -(cardWidth + 24), behavior: 'smooth' });
        });
      }

      if (nextBtn && !nextBtn._bound) {
        nextBtn._bound = true;
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const card = grid.querySelector('.product-card, > *');
          const cardWidth = card ? card.clientWidth : 300;
          grid.scrollBy({ left: (cardWidth + 24), behavior: 'smooth' });
        });
      }

      updateArrows();
    });
  }

  // 2. Universal Tab Switcher Component
  function initUniversalTabs(container) {
    const scope = container || document;
    const tablists = scope.querySelectorAll('[role="tablist"], .featured-collection__tabs');

    tablists.forEach(tablist => {
      const buttons = tablist.querySelectorAll('[role="tab"], .featured-collection__tab-btn');
      const sectionParent = tablist.closest('.shopify-section') || tablist.parentElement;

      buttons.forEach(button => {
        if (button._tabBound) return;
        button._tabBound = true;

        button.addEventListener('click', function(e) {
          e.preventDefault();
          const targetId = this.dataset.tabTarget;
          if (!targetId) return;

          buttons.forEach(btn => {
            btn.classList.remove('is-active');
            btn.setAttribute('aria-selected', 'false');
          });

          const panels = sectionParent.querySelectorAll('[role="tabpanel"], .featured-collection__tab-panel');
          panels.forEach(panel => {
            panel.classList.remove('is-active');
          });

          this.classList.add('is-active');
          this.setAttribute('aria-selected', 'true');

          const targetPanel = sectionParent.querySelector('#' + targetId) || document.getElementById(targetId);
          if (targetPanel) {
            targetPanel.classList.add('is-active');
            initUniversalCarousels(targetPanel);
          }
        });
      });
    });
  }

  // 3. Universal AJAX Add To Cart (Delegated at document level)
  function initUniversalAddToCart() {
    if (window._quickAddBound) return;
    window._quickAddBound = true;

    document.addEventListener('click', function(e) {
      const button = e.target.closest('.product-card__quick-add, [data-quick-add]');
      if (!button) return;

      e.preventDefault();
      e.stopPropagation();

      const variantId = button.dataset.variantId;
      if (!variantId) return;

      const bagIcon = button.querySelector('.product-card__bag-icon');
      const loadingIcon = button.querySelector('.product-card__loading-icon');

      if (bagIcon) bagIcon.classList.add('hide');
      if (loadingIcon) loadingIcon.classList.remove('hide');
      button.disabled = true;

      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: 1
        })
      })
      .then(response => {
        if (!response.ok) throw new Error('Network error adding to cart');
        return response.json();
      })
      .then(data => {
        document.dispatchEvent(new CustomEvent('cart:item-added', { detail: data }));
        document.dispatchEvent(new CustomEvent('cart:open'));
      })
      .catch(err => {
        console.error('Add to cart failed:', err);
      })
      .finally(() => {
        if (bagIcon) bagIcon.classList.remove('hide');
        if (loadingIcon) loadingIcon.classList.add('hide');
        button.disabled = false;
      });
    });
  }

  // Money Formatter Helper
  function formatMoney(cents) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    const value = (cents / 100).toFixed(2);
    const format = (window.theme && window.theme.moneyFormat) || '${{amount}}';
    return format
      .replace('{{amount}}', value)
      .replace('{{amount_with_comma_separator}}', value.replace('.', ','))
      .replace('{{amount_no_decimals}}', Math.round(cents / 100));
  }

  // 4. Universal Predictive Search (Prestige-Style)
  function initPredictiveSearch(container) {
    const scope = container || document;
    const roots = scope.querySelectorAll('[data-predictive-search-root]');

    roots.forEach(root => {
      if (root._predictiveBound) return;
      root._predictiveBound = true;

      const input = root.querySelector('[data-predictive-search-input]');
      const clearBtn = root.querySelector('[data-search-clear]');
      const resultsContainer = root.querySelector('[data-predictive-search-results]');
      const suggestionsList = root.querySelector('[data-suggestions-list]');
      const productsGrid = root.querySelector('[data-products-grid]');
      const collectionsList = root.querySelector('[data-collections-list]');
      const productsCount = root.querySelector('[data-count="products"]');
      const collectionsCount = root.querySelector('[data-count="collections"]');
      const viewAllLink = root.querySelector('[data-view-all-link]');
      const viewAllTerm = root.querySelector('[data-view-all-term]');
      const tabs = root.querySelectorAll('[data-search-tab]');
      const panels = root.querySelectorAll('[data-panel]');

      if (!input) return;

      let debounceTimer = null;

      // Handle tab switching
      tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          const targetTab = tab.dataset.searchTab;
          tabs.forEach(t => {
            t.classList.remove('is-active');
            t.setAttribute('aria-selected', 'false');
          });
          panels.forEach(p => {
            p.classList.remove('is-active');
            p.style.display = 'none';
          });
          tab.classList.add('is-active');
          tab.setAttribute('aria-selected', 'true');
          const activePanel = root.querySelector(`[data-panel="${targetTab}"]`);
          if (activePanel) {
            activePanel.classList.add('is-active');
            activePanel.style.display = 'block';
          }
        });
      });

      // Clear button
      if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
          e.preventDefault();
          input.value = '';
          clearBtn.classList.add('hide');
          if (resultsContainer) resultsContainer.style.display = 'none';
          input.focus();
        });
      }

      // Input event with debounce
      input.addEventListener('input', () => {
        const query = input.value.trim();

        if (clearBtn) {
          if (query.length > 0) {
            clearBtn.classList.remove('hide');
          } else {
            clearBtn.classList.add('hide');
          }
        }

        if (query.length < 2) {
          if (resultsContainer) resultsContainer.style.display = 'none';
          return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchPredictiveResults(query);
        }, 220);
      });

      function fetchPredictiveResults(query) {
        const endpoint = `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,collection,query&resources[options][unavailable_products]=last`;

        fetch(endpoint)
          .then(res => {
            if (!res.ok) throw new Error('Search failed');
            return res.json();
          })
          .then(data => {
            renderResults(data, query);
          })
          .catch(err => {
            console.error('Predictive search error:', err);
          });
      }

      function renderResults(data, query) {
        const results = (data && data.resources && data.resources.results) || {};
        const products = results.products || [];
        const collections = results.collections || [];
        const queries = results.queries || [];

        if (products.length === 0 && collections.length === 0 && queries.length === 0) {
          if (resultsContainer) resultsContainer.style.display = 'none';
          return;
        }

        // Render Suggestions
        if (suggestionsList) {
          if (queries.length > 0) {
            suggestionsList.innerHTML = queries.map(q => `
              <li class="predictive-search__suggestion-item">
                <a href="${q.url}">${q.styled_text || q.text}</a>
              </li>
            `).join('');
          } else {
            suggestionsList.innerHTML = `
              <li class="predictive-search__suggestion-item">
                <a href="/search?q=${encodeURIComponent(query)}">${query}</a>
              </li>
            `;
          }
        }

        // Render Products
        if (productsGrid) {
          if (products.length > 0) {
            productsGrid.innerHTML = products.map(prod => `
              <a href="${prod.url}" class="predictive-product">
                <div class="predictive-product__media">
                  ${prod.image ? `<img src="${prod.image}" alt="${prod.title}" class="predictive-product__image" loading="lazy">` : `<div style="width:100%;height:100%;background:#f0f0f0;"></div>`}
                </div>
                <h4 class="predictive-product__title">${prod.title}</h4>
                <span class="predictive-product__price">${formatMoney(prod.price * 100 || prod.price)}</span>
              </a>
            `).join('');
          } else {
            productsGrid.innerHTML = `<p style="opacity: 0.7; font-size: 0.875rem; grid-column: 1 / -1;">No products found</p>`;
          }
        }
        if (productsCount) productsCount.textContent = products.length;

        // Render Collections
        if (collectionsList) {
          if (collections.length > 0) {
            collectionsList.innerHTML = collections.map(col => `
              <a href="${col.url}" class="predictive-collection-tag">${col.title}</a>
            `).join('');
          } else {
            collectionsList.innerHTML = `<p style="opacity: 0.7; font-size: 0.875rem;">No collections found</p>`;
          }
        }
        if (collectionsCount) collectionsCount.textContent = collections.length;

        // View all link
        if (viewAllLink && viewAllTerm) {
          viewAllLink.href = `/search?q=${encodeURIComponent(query)}`;
          viewAllTerm.textContent = query;
        }

        if (resultsContainer) {
          resultsContainer.style.display = 'block';
        }
      }
    });
  }

  // 5. Header Search Drawer
  function initHeaderSearchDrawer() {
    const trigger = document.querySelector('[data-header-search-trigger]');
    const drawer = document.getElementById('HeaderSearchDrawer');
    if (!trigger || !drawer) return;

    function openDrawer(e) {
      if (e) e.preventDefault();
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const input = drawer.querySelector('[data-predictive-search-input]');
      if (input) setTimeout(() => input.focus(), 100);
    }

    function closeDrawer(e) {
      if (e) e.preventDefault();
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (!trigger._drawerBound) {
      trigger._drawerBound = true;
      trigger.addEventListener('click', openDrawer);
    }

    drawer.querySelectorAll('[data-search-close]').forEach(btn => {
      if (btn._closeBound) return;
      btn._closeBound = true;
      btn.addEventListener('click', closeDrawer);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });
  }

  // Initialize all globally
  function initAll(scope) {
    initUniversalCarousels(scope);
    initUniversalTabs(scope);
    initUniversalAddToCart();
    initPredictiveSearch(scope);
    initHeaderSearchDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(document));
  } else {
    initAll(document);
  }

  // Shopify Theme Editor Section Lifecycle
  document.addEventListener('shopify:section:load', function(e) {
    initAll(e.target);
  });
})();

