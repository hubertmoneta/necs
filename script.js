/*
============================================================================
NECS — client-side functionality
============================================================================
Plain JavaScript, no external dependencies.

1. Search / filtering
2. Copy buttons
3. Anchor navigation
4. IPv4 helpers
5. Live IPv4 subnet calculator
5B. Active sticky subnav
6. VLSM calculator

ADDING COMMANDS:
You normally do NOT need to edit this file. Add a .command-card in index.html;
the search engine automatically indexes its visible text and data-search value.
============================================================================
*/

/* =========================================================================
   1. SEARCH
   ========================================================================= */

const searchInput = document.getElementById('search');
const cards = [...document.querySelectorAll('.command-card')];
const sections = [...document.querySelectorAll('.command-section')];
const noResults = document.getElementById('no-results');
const resultCount = document.getElementById('result-count');

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function filterCommands() {
  const query = normalize(searchInput?.value);
  let visibleCards = 0;

  cards.forEach(card => {
    const searchableText = normalize(
      `${card.innerText} ${card.dataset.search || ''}`
    );

    const matches = !query || searchableText.includes(query);

    card.hidden = !matches;

    if (matches) {
      visibleCards++;
    }
  });

  sections.forEach(section => {
    const sectionCards = [...section.querySelectorAll('.command-card')];

    if (!sectionCards.length) {
      return;
    }

    const visible = sectionCards.filter(card => !card.hidden).length;

    section.hidden = query !== '' && visible === 0;

    if (!section.classList.contains('tool-section')) {
      section.querySelectorAll('h3').forEach(heading => {
        let sibling = heading.nextElementSibling;
        let hasVisibleCard = false;

        while (sibling && sibling.tagName !== 'H3') {
          if (
            sibling.classList?.contains('command-card') &&
            !sibling.hidden
          ) {
            hasVisibleCard = true;
            break;
          }

          sibling = sibling.nextElementSibling;
        }

        heading.hidden = query !== '' && !hasVisibleCard;
      });
    }
  });

  if (noResults) {
    noResults.hidden = visibleCards !== 0 || query === '';
  }

  if (resultCount) {
    resultCount.textContent = query
      ? `${visibleCards} result${visibleCards === 1 ? '' : 's'}`
      : '';
  }
}

searchInput?.addEventListener('input', filterCommands);

document.addEventListener('keydown', event => {
  const target = event.target;

  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable;

  if (event.key === '/' && !typing && searchInput) {
    event.preventDefault();

    searchInput.focus();
    searchInput.select();
  }

  if (
    event.key === 'Escape' &&
    document.activeElement === searchInput
  ) {
    searchInput.value = '';

    filterCommands();

    searchInput.blur();
  }
});


/* =========================================================================
   2. COPY BUTTONS
   ========================================================================= */

document.querySelectorAll('.copy-btn').forEach(button => {
  button.addEventListener('click', async () => {
    const code =
      button
        .closest('.command-header')
        ?.querySelector('code')
        ?.innerText || '';

    try {
      await navigator.clipboard.writeText(code);

      const previous = button.textContent;

      button.textContent = 'Copied';

      setTimeout(() => {
        button.textContent = previous;
      }, 1200);
    } catch {
      button.textContent = 'Copy failed';

      setTimeout(() => {
        button.textContent = 'Copy';
      }, 1200);
    }
  });
});


/* =========================================================================
   3. ANCHOR NAVIGATION
   ========================================================================= */

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    if (searchInput?.value) {
      searchInput.value = '';

      filterCommands();
    }
  });
});


/* =========================================================================
   4. IPv4 HELPERS
   ========================================================================= */

function parseIPv4(ip) {
  const parts = String(ip).trim().split('.');

  if (parts.length !== 4) {
    throw new Error(
      'IPv4 address must contain four octets.'
    );
  }

  return parts.map(part => {
    if (!/^\d{1,3}$/.test(part)) {
      throw new Error(
        'IPv4 octets must be decimal numbers.'
      );
    }

    const n = Number(part);

    if (n < 0 || n > 255) {
      throw new Error(
        'Each IPv4 octet must be between 0 and 255.'
      );
    }

    return n;
  });
}

function octetsToUint32(parts) {
  return (
    ((parts[0] << 24) >>> 0) +
    (parts[1] << 16) +
    (parts[2] << 8) +
    parts[3]
  ) >>> 0;
}

function uint32ToIPv4(value) {
  value >>>= 0;

  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join('.');
}

function prefixToMask(prefix) {
  if (prefix === 0) {
    return 0 >>> 0;
  }

  return (
    0xffffffff << (32 - prefix)
  ) >>> 0;
}

function maskToPrefix(maskText) {
  const value = String(maskText).trim();

  if (value.startsWith('/')) {
    const prefix = Number(
      value.slice(1)
    );

    if (
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > 32
    ) {
      throw new Error(
        'CIDR prefix must be between /0 and /32.'
      );
    }

    return prefix;
  }

  if (/^\d{1,2}$/.test(value)) {
    const prefix = Number(value);

    if (
      prefix >= 0 &&
      prefix <= 32
    ) {
      return prefix;
    }
  }

  const mask =
    octetsToUint32(
      parseIPv4(value)
    );

  const binary =
    mask
      .toString(2)
      .padStart(32, '0');

  if (!/^1*0*$/.test(binary)) {
    throw new Error(
      'Subnet mask must have contiguous 1 bits followed by 0 bits.'
    );
  }

  return binary.includes('0')
    ? binary.indexOf('0')
    : 32;
}

function classifyIPv4(ipUint) {
  const a =
    (ipUint >>> 24) & 255;

  const b =
    (ipUint >>> 16) & 255;

  if (a === 10) {
    return 'Private RFC1918';
  }

  if (
    a === 172 &&
    b >= 16 &&
    b <= 31
  ) {
    return 'Private RFC1918';
  }

  if (
    a === 192 &&
    b === 168
  ) {
    return 'Private RFC1918';
  }

  if (a === 127) {
    return 'Loopback';
  }

  if (
    a === 169 &&
    b === 254
  ) {
    return 'Link-local / APIPA';
  }

  if (
    a === 100 &&
    b >= 64 &&
    b <= 127
  ) {
    return 'Shared space / CGNAT';
  }

  if (
    a >= 224 &&
    a <= 239
  ) {
    return 'Multicast';
  }

  if (a >= 240) {
    return 'Reserved / experimental';
  }

  if (ipUint === 0xffffffff) {
    return 'Limited broadcast';
  }

  if (ipUint === 0) {
    return 'Unspecified / this network';
  }

  return 'Public or other special-use';
}

function setResult(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}


/* =========================================================================
   5. LIVE IPv4 SUBNET CALCULATOR
   ========================================================================= */

function ipv4Class(ipUint) {
  const first = (ipUint >>> 24) & 255;

  if (first >= 1 && first <= 126) return 'A';
  if (first >= 128 && first <= 191) return 'B';
  if (first >= 192 && first <= 223) return 'C';
  if (first >= 224 && first <= 239) return 'D (multicast)';
  if (first >= 240) return 'E / reserved';

  return 'Special';
}

function clampPrefix(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 24;
  }

  return Math.max(
    0,
    Math.min(
      32,
      Math.round(number)
    )
  );
}

function updatePrefixUI(prefix) {
  const prefixInput =
    document.getElementById('calc-prefix');

  const slider =
    document.getElementById('calc-prefix-slider');

  if (prefixInput) {
    prefixInput.value =
      String(prefix);
  }

  if (slider) {
    slider.value =
      String(prefix);
  }

  const mask =
    prefixToMask(prefix);

  const maskField =
    document.getElementById('calc-mask');

  if (maskField) {
    maskField.value =
      uint32ToIPv4(mask);
  }

  setResult(
    'network-bits-label',
    prefix
  );

  setResult(
    'host-bits-label',
    32 - prefix
  );

  const bar =
    document.getElementById('network-bit-bar');

  if (bar) {
    bar.style.width =
      `${(prefix / 32) * 100}%`;
  }
}

function calculateSubnet() {
  const errorBox =
    document.getElementById('calc-error');

  try {
    const ipField =
      document.getElementById('calc-ip');

    const prefixField =
      document.getElementById('calc-prefix');

    const ipUint =
      octetsToUint32(
        parseIPv4(
          ipField.value
        )
      );

    const prefix =
      clampPrefix(
        prefixField.value
      );

    updatePrefixUI(prefix);

    const mask =
      prefixToMask(prefix);

    const wildcard =
      (~mask) >>> 0;

    const network =
      (ipUint & mask) >>> 0;

    const broadcast =
      (network | wildcard) >>> 0;

    const total =
      2 ** (32 - prefix);

    let first;
    let last;
    let usable;
    let range;

    if (prefix === 32) {
      first =
        uint32ToIPv4(network);

      last =
        uint32ToIPv4(network);

      usable = 1;
      range = first;
    } else if (prefix === 31) {
      first =
        uint32ToIPv4(network);

      last =
        uint32ToIPv4(broadcast);

      usable = 2;

      range =
        `${first} – ${last}`;
    } else {
      first =
        uint32ToIPv4(
          (network + 1) >>> 0
        );

      last =
        uint32ToIPv4(
          (broadcast - 1) >>> 0
        );

      usable =
        Math.max(
          total - 2,
          0
        );

      range =
        `${first} – ${last}`;
    }

    const binaryMask = [
      (mask >>> 24) & 255,
      (mask >>> 16) & 255,
      (mask >>> 8) & 255,
      mask & 255
    ]
      .map(n =>
        n
          .toString(2)
          .padStart(8, '0')
      )
      .join('.');

    const networkText =
      uint32ToIPv4(network);

    const maskText =
      uint32ToIPv4(mask);

    setResult(
      'result-network',
      networkText
    );

    setResult(
      'result-broadcast',
      uint32ToIPv4(broadcast)
    );

    setResult(
      'result-range',
      range
    );

    setResult(
      'result-cidr-network',
      `${networkText}/${prefix}`
    );

    setResult(
      'result-mask',
      maskText
    );

    setResult(
      'result-wildcard',
      uint32ToIPv4(wildcard)
    );

    setResult(
      'result-binary',
      binaryMask
    );

    setResult(
      'result-total',
      total.toLocaleString('en-US')
    );

    setResult(
      'result-usable',
      usable.toLocaleString('en-US')
    );

    setResult(
      'result-type',
      classifyIPv4(ipUint)
    );

    setResult(
      'result-class',
      ipv4Class(ipUint)
    );

    setResult(
      'result-cidr',
      `/${prefix}`
    );

    setResult(
      'result-first',
      first
    );

    setResult(
      'result-last',
      last
    );

    setResult(
      'result-integer',
      ipUint.toString()
    );

    errorBox.hidden = true;
    errorBox.textContent = '';
  } catch (error) {
    errorBox.textContent =
      error.message;

    errorBox.hidden = false;
  }
}

const calcIp =
  document.getElementById('calc-ip');

const calcPrefix =
  document.getElementById('calc-prefix');

const calcPrefixSlider =
  document.getElementById('calc-prefix-slider');

calcIp?.addEventListener(
  'input',
  calculateSubnet
);

calcPrefix?.addEventListener(
  'input',
  () => {
    const prefix =
      clampPrefix(
        calcPrefix.value
      );

    updatePrefixUI(prefix);

    calculateSubnet();
  }
);

calcPrefixSlider?.addEventListener(
  'input',
  () => {
    const prefix =
      clampPrefix(
        calcPrefixSlider.value
      );

    if (calcPrefix) {
      calcPrefix.value =
        String(prefix);
    }

    updatePrefixUI(prefix);

    calculateSubnet();
  }
);

document
  .querySelectorAll('.preset-btn')
  .forEach(button => {
    button.addEventListener(
      'click',
      () => {
        if (calcIp) {
          calcIp.value =
            button.dataset.ip ||
            '192.168.1.100';
        }

        const prefix =
          clampPrefix(
            button.dataset.prefix ||
            24
          );

        if (calcPrefix) {
          calcPrefix.value =
            String(prefix);
        }

        updatePrefixUI(prefix);

        calculateSubnet();
      }
    );
  });

document
  .querySelectorAll('.mini-copy')
  .forEach(button => {
    button.addEventListener(
      'click',
      async () => {
        const targetId =
          button.dataset.copyTarget;

        const target =
          targetId
            ? document.getElementById(targetId)
            : null;

        if (!target) {
          return;
        }

        try {
          await navigator.clipboard.writeText(
            target.textContent.trim()
          );

          const previous =
            button.textContent;

          button.textContent =
            'Copied';

          setTimeout(() => {
            button.textContent =
              previous;
          }, 1000);
        } catch {
          button.textContent =
            'Failed';

          setTimeout(() => {
            button.textContent =
              'Copy';
          }, 1000);
        }
      }
    );
  });

if (calcIp && calcPrefix) {
  updatePrefixUI(
    clampPrefix(
      calcPrefix.value
    )
  );

  calculateSubnet();
}


/* =========================================================================
   5B. ACTIVE STICKY SUBNAV
   ========================================================================= */

const subnavLinks = [
  ...document.querySelectorAll(
    '.subnav a[href^="#"]'
  )
];

const watchedTargets =
  subnavLinks
    .map(link => {
      const id =
        link
          .getAttribute('href')
          ?.slice(1);

      return id
        ? {
            link,
            target:
              document.getElementById(id)
          }
        : null;
    })
    .filter(
      item =>
        item?.target
    );

if (
  'IntersectionObserver' in window &&
  watchedTargets.length
) {
  const visibleTargets =
    new Map();

  const observer =
    new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          visibleTargets.set(
            entry.target.id,
            entry.isIntersecting
              ? entry.boundingClientRect.top
              : null
          );
        });

        const candidates =
          watchedTargets
            .map(item => ({
              ...item,
              top:
                visibleTargets.get(
                  item.target.id
                )
            }))
            .filter(
              item =>
                item.top !== null &&
                item.top !== undefined
            )
            .sort(
              (a, b) =>
                Math.abs(a.top) -
                Math.abs(b.top)
            );

        subnavLinks.forEach(
          link =>
            link.classList.remove(
              'is-active'
            )
        );

        if (candidates[0]) {
          candidates[0]
            .link
            .classList
            .add('is-active');
        }
      },
      {
        rootMargin:
          '-150px 0px -68% 0px',

        threshold:
          [0, 0.01]
      }
    );

  watchedTargets.forEach(
    item =>
      observer.observe(
        item.target
      )
  );
}


/* =========================================================================
   6. VLSM CALCULATOR
   ========================================================================= */

function prefixForHosts(requiredHosts) {
  if (
    !Number.isInteger(requiredHosts) ||
    requiredHosts < 1
  ) {
    throw new Error(
      'Every host requirement must be a positive integer.'
    );
  }

  for (
    let prefix = 30;
    prefix >= 0;
    prefix--
  ) {
    const total =
      2 ** (32 - prefix);

    if (
      total - 2 >= requiredHosts
    ) {
      return prefix;
    }
  }

  throw new Error(
    'Host requirement is too large for IPv4.'
  );
}

function parseParentNetwork(value) {
  const match =
    String(value)
      .trim()
      .match(
        /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/
      );

  if (!match) {
    throw new Error(
      'Use parent CIDR notation, e.g. 10.10.0.0/16.'
    );
  }

  const ip =
    octetsToUint32(
      parseIPv4(match[1])
    );

  const prefix =
    Number(match[2]);

  const mask =
    prefixToMask(prefix);

  const network =
    (ip & mask) >>> 0;

  const broadcast =
    (
      network |
      ((~mask) >>> 0)
    ) >>> 0;

  return {
    prefix,
    network,
    broadcast
  };
}

function parseHostRequirements(value) {
  const items =
    String(value)
      .split(/[,;\s]+/)
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean);

  if (!items.length) {
    throw new Error(
      'Enter at least one host requirement.'
    );
  }

  return items.map(
    (item, index) => {
      if (!/^\d+$/.test(item)) {
        throw new Error(
          `Invalid host requirement: "${item}".`
        );
      }

      const hosts =
        Number(item);

      if (
        !Number.isSafeInteger(hosts) ||
        hosts < 1
      ) {
        throw new Error(
          `Requirement #${index + 1} must be a positive integer.`
        );
      }

      return {
        originalIndex:
          index + 1,

        requestedHosts:
          hosts,

        prefix:
          prefixForHosts(hosts)
      };
    }
  );
}

function alignToBlock(
  address,
  blockSize
) {
  const remainder =
    address % blockSize;

  return remainder === 0
    ? address
    : address +
        (
          blockSize -
          remainder
        );
}

function allocateVLSM() {
  const errorBox =
    document.getElementById(
      'vlsm-error'
    );

  const tbody =
    document.getElementById(
      'vlsm-results'
    );

  const summary =
    document.getElementById(
      'vlsm-summary'
    );

  try {
    const parent =
      parseParentNetwork(
        document.getElementById(
          'vlsm-network'
        ).value
      );

    const requests =
      parseHostRequirements(
        document.getElementById(
          'vlsm-hosts'
        ).value
      );

    requests.sort(
      (a, b) =>
        b.requestedHosts -
          a.requestedHosts ||
        a.originalIndex -
          b.originalIndex
    );

    let cursor =
      parent.network;

    const allocations = [];

    for (
      const request of requests
    ) {
      if (
        request.prefix <
        parent.prefix
      ) {
        throw new Error(
          `${request.requestedHosts} hosts require /${request.prefix}, ` +
          `which is larger than the parent /${parent.prefix} network.`
        );
      }

      const blockSize =
        2 ** (
          32 -
          request.prefix
        );

      const network =
        alignToBlock(
          cursor,
          blockSize
        );

      const broadcast =
        network +
        blockSize -
        1;

      if (
        broadcast >
          parent.broadcast ||
        broadcast >
          0xffffffff
      ) {
        throw new Error(
          'Requested subnets do not fit inside the parent network.'
        );
      }

      allocations.push({
        ...request,

        blockSize,

        network,

        broadcast,

        mask:
          prefixToMask(
            request.prefix
          ),

        first:
          network + 1,

        last:
          broadcast - 1,

        usableCapacity:
          blockSize - 2
      });

      cursor =
        broadcast + 1;
    }

    tbody.innerHTML =
      allocations
        .map(
          (item, index) => `
            <tr>
              <td>
                ${index + 1}
              </td>

              <td>
                ${item.requestedHosts.toLocaleString('en-US')}
              </td>

              <td>
                <code>
                  ${uint32ToIPv4(item.network)}/${item.prefix}
                </code>
              </td>

              <td>
                <code>
                  ${uint32ToIPv4(item.mask)}
                </code>
              </td>

              <td>
                <code>
                  ${uint32ToIPv4(item.first)}
                  –
                  ${uint32ToIPv4(item.last)}
                </code>
              </td>

              <td>
                <code>
                  ${uint32ToIPv4(item.broadcast)}
                </code>
              </td>

              <td>
                ${item.usableCapacity.toLocaleString('en-US')}
              </td>
            </tr>
          `
        )
        .join('');

    const used =
      allocations.reduce(
        (sum, item) =>
          sum + item.blockSize,
        0
      );

    const parentTotal =
      2 ** (
        32 -
        parent.prefix
      );

    summary.innerHTML = `
      Allocated
      <strong>
        ${allocations.length}
      </strong>
      subnet(s).

      Used
      <strong>
        ${used.toLocaleString('en-US')}
      </strong>
      of
      <strong>
        ${parentTotal.toLocaleString('en-US')}
      </strong>
      addresses.

      Remaining address count:
      <strong>
        ${(parentTotal - used).toLocaleString('en-US')}
      </strong>.
    `;

    errorBox.hidden = true;
    errorBox.textContent = '';
  } catch (error) {
    errorBox.textContent =
      error.message;

    errorBox.hidden = false;

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          Allocation failed.
        </td>
      </tr>
    `;

    summary.textContent = '';
  }
}

document
  .getElementById('vlsm-button')
  ?.addEventListener(
    'click',
    allocateVLSM
  );

document
  .getElementById('vlsm-example')
  ?.addEventListener(
    'click',
    () => {
      document.getElementById(
        'vlsm-network'
      ).value =
        '10.10.0.0/16';

      document.getElementById(
        'vlsm-hosts'
      ).value =
        '500, 200, 50, 20';

      allocateVLSM();
    }
  );

[
  'vlsm-network',
  'vlsm-hosts'
].forEach(id => {
  document
    .getElementById(id)
    ?.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Enter'
        ) {
          allocateVLSM();
        }
      }
    );
});

if (
  document.getElementById(
    'vlsm-network'
  )
) {
  allocateVLSM();
}
