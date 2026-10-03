// gridview.js
// Provides a simple grid view constructor for displaying file names with selection.
// Usage: const view = new GridView({ gridId: 'fileGrid' });
// Exposed methods: setDatasource(list), setSelectedIndex(idx), getSelectedIndex(), refresh(), onSelect(cb), scrollToIndex(idx)
(function(global){
    function GridView(opts) {
        if (!(this instanceof GridView)) {
            return new GridView(opts);
        }

        if (!opts || !opts.rootView) {
            throw new Error('GridView requires { rootView }');
        }

        this.container = document.querySelector(opts.rootView);
        this.dataSource = [];
        this.selectedIndex = -1;
        this.selectCallback = null;

        this.render();
    }

    GridView.prototype.render = function() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.dataSource.forEach((name, idx) => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.textContent = name;
            card.dataset.idx = idx;
            if (idx === this.selectedIndex) card.classList.add('selected');
            card.addEventListener('click', () => {
                this.setSelectedIndex(idx, true);
            });
            this.container.appendChild(card);
        });
    };

    GridView.prototype.setDatasource = function(list) {
        // 不尝试在变更datasource的时候保留选中项，因为在输入中文的过程中，文本框的内容随时在变，会导致达不到预期的表现
        this.dataSource = Array.isArray(list) ? Array.from(list) : [];
        this.selectedIndex = -1;
        this.render();
    };

    GridView.prototype.setSelectedIndex = function(idx, emitEvent) {
        if (idx == null || idx < -1) return;
        if (idx >= this.dataSource.length) return;
        this.selectedIndex = idx;

        if (this.container) {
            const prev = this.container.querySelector('.file-card.selected');
            if (prev) prev.classList.remove('selected');
            const newEl = this.container.querySelector(`.file-card[data-idx=\"${idx}\"]`);
            if (newEl) newEl.classList.add('selected');
        }

        const selectedName = this.selectedIndex >= 0 ? this.dataSource[this.selectedIndex] : null;
        if (emitEvent !== false && typeof this.selectCallback === 'function') {
            this.selectCallback(this.selectedIndex, selectedName);
        }
    };

    GridView.prototype.getSelectedIndex = function() {
        return this.selectedIndex;
    };

    GridView.prototype.refresh = function() {
        this.render();
    };

    GridView.prototype.onSelect = function(cb) {
        this.selectCallback = typeof cb === 'function' ? cb : null;
        return this;
    };

    GridView.prototype.scrollToIndex = function(idx) {
        if (!this.container || idx == null || idx < 0 || idx >= this.dataSource.length) return;
        const item = this.container.querySelector(`.file-card[data-idx=\"${idx}\"]`);
        if (item && typeof item.scrollIntoView === 'function') {
            item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    };

    global.GridView = GridView;
})(window);
