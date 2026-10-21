// ==============================
// 1. 데이터: 앱이 기억하는 정보
// ==============================

// 차수는 최대 3차까지
const MAX_ROUNDS = 3;

// 참석자 이름 목록 (예: ["김팀장", "이대리"])
let people = [];

// 차수 목록. 차수 하나는 이런 모양:
// {
//   amount: 320000,            총 금액
//   attendees: ["김팀장", ...], 이 차수에 참석한 사람
//   method: "equal",           정산 방식: "equal"(1/N) 또는 "sponsor"(특정인 부담 후 1/N)
//   sponsor: "김팀장",          부담자 (method가 "sponsor"일 때만 사용)
//   sponsorAmount: 100000      부담액 (method가 "sponsor"일 때만 사용)
// }
let rounds = [createRound()];

// 움직임 효과용 기억
let newRoundIndex = -1;    // 방금 추가된 차수 번호 (그 카드만 나타나는 효과)
let previousAmounts = {};  // 직전 결과 금액 (바뀐 금액만 반짝이는 효과)


// ==============================
// 2. 화면 요소 찾기 (index.html의 id로 찾음)
// ==============================

const nameInput = document.getElementById("name-input");
const addPersonBtn = document.getElementById("add-person-btn");
const peopleList = document.getElementById("people-list");
const roundsList = document.getElementById("rounds-list");
const addRoundBtn = document.getElementById("add-round-btn");
const resultList = document.getElementById("result-list");
const totalMessage = document.getElementById("total-message");
const extraMessage = document.getElementById("extra-message");
const warningList = document.getElementById("warning-list");
const copyBtn = document.getElementById("copy-btn");
const toast = document.getElementById("toast");
const receiptDate = document.getElementById("receipt-date");


// ==============================
// 3. 동작: 데이터를 바꾸는 함수들
// ==============================

// 새 차수 만들기 (기본값: 현재 참석자 전원 체크, 1/N)
function createRound() {
  return {
    amount: 0,
    attendees: [...people],
    method: "equal",
    sponsor: "",
    sponsorAmount: 0,
  };
}

// 입력칸의 이름을 참석자 목록에 추가
function addPerson() {
  const name = nameInput.value.trim(); // 앞뒤 공백 제거

  if (name === "") {
    return; // 빈 이름은 무시
  }
  if (people.includes(name)) {
    alert(`'${name}'은(는) 이미 있는 이름이에요.`);
    return;
  }

  people.push(name);
  // 새로 추가한 사람은 모든 차수에 참석으로 체크
  for (const round of rounds) {
    round.attendees.push(name);
  }

  nameInput.value = ""; // 입력칸 비우기
  nameInput.focus();    // 바로 다음 이름을 입력할 수 있게
  render();
}

// 참석자 목록에서 이름 삭제 (모든 차수에서도 함께 빠짐)
function removePerson(name) {
  people = people.filter((p) => p !== name);
  for (const round of rounds) {
    round.attendees = round.attendees.filter((p) => p !== name);
    if (round.sponsor === name) {
      round.sponsor = "";
    }
  }
  render();
}

// 차수 추가 (최대 3차)
function addRound() {
  if (rounds.length >= MAX_ROUNDS) {
    return;
  }
  rounds.push(createRound());
  newRoundIndex = rounds.length - 1;
  render();
  newRoundIndex = -1;
}

// 차수 삭제 (뒤 차수는 번호가 하나씩 당겨짐)
function removeRound(index) {
  // 금액을 이미 넣은 차수는 실수로 지우지 않도록 한 번 더 물어봄
  if (rounds[index].amount > 0 && !confirm(`${index + 1}차를 삭제할까요?`)) {
    return;
  }
  rounds.splice(index, 1);
  render();
}

// 차수의 참석 체크를 켜고 끄기
function toggleAttendee(round, name, checked) {
  if (checked) {
    round.attendees.push(name);
  } else {
    round.attendees = round.attendees.filter((p) => p !== name);
    // 부담자가 불참으로 바뀌면 부담자 선택을 비움
    if (round.sponsor === name) {
      round.sponsor = "";
    }
  }
  render();
}

// 정산 방식 바꾸기
function changeMethod(round, method) {
  round.method = method;
  // '특정인 부담'으로 바꿀 때 부담자가 비어 있으면 첫 번째 참석자로 정함
  if (method === "sponsor" && round.sponsor === "") {
    round.sponsor = attendeesInOrder(round)[0] || "";
  }
  render();
}


// ==============================
// 4. 계산: 데이터만 보고 사람별 금액을 구함 (화면은 건드리지 않음)
// ==============================

// 100원 단위로 올림
// (나눗셈 결과가 103333.3333처럼 소수가 되거나, 컴퓨터 계산 오차로
//  100000.0000001처럼 나올 수 있어서 아주 작은 오차는 무시하고 올림)
function roundUpTo100(number) {
  if (number < 0.001) {
    return 0; // 낼 돈이 없는 사람 ("-0원"으로 표시되는 것 방지)
  }
  return Math.ceil((number - 0.001) / 100) * 100;
}

// 정산 계산
// 돌려주는 값:
// {
//   amounts: { "김팀장": 130000, ... },  사람별 낼 금액 (100원 올림 후)
//   spent: 410000,                        실제로 쓴 총액
//   collected: 410200,                    걷는 총액 (올림 후 합계)
//   warnings: ["2차에 참석자가 없어요"],   계산에서 빠진 차수 안내
//   summaries: ["1차 320,000원 (4명)"],   계산에 들어간 차수 요약 (복사용)
//   breakdown: { "김팀장": [{ round: 0, amount: 100000, sponsor: true }, ...] }
//                                         사람별 차수 내역 (결과 카드에 작게 표시)
// }
function calculate() {
  // 사람별 정확한 금액 (소수 포함), 처음엔 모두 0원
  const exact = {};
  for (const name of people) {
    exact[name] = 0;
  }

  let spent = 0;
  const warnings = [];
  const summaries = [];

  // 사람별 차수 내역, 처음엔 모두 빈 목록
  const breakdown = {};
  for (const name of people) {
    breakdown[name] = [];
  }

  // name이 index번째 차수에서 amount원을 내도록 더함
  function addShare(name, index, amount, isSponsor = false) {
    exact[name] += amount;
    if (amount > 0) {
      breakdown[name].push({ round: index, amount, sponsor: isSponsor });
    }
  }

  rounds.forEach((round, index) => {
    const roundName = `${index + 1}차`;

    if (round.amount === 0) {
      return; // 금액을 아직 안 넣은 차수는 건너뜀
    }
    if (round.attendees.length === 0) {
      warnings.push(`${roundName}에 참석자가 없어서 계산에서 뺐어요.`);
      return;
    }
    if (round.method === "sponsor") {
      // 특정인 부담: 부담자가 부담액을 내고, 남은 금액을 부담자를 뺀 참석자끼리 1/N
      const others = round.attendees.filter((p) => p !== round.sponsor);
      const rest = round.amount - round.sponsorAmount;

      if (round.sponsor === "") {
        warnings.push(`${roundName}의 부담자를 선택해 주세요.`);
        return;
      }
      if (round.sponsorAmount === 0) {
        warnings.push(`${roundName}의 부담액을 입력해 주세요.`);
        return;
      }
      if (rest < 0) {
        warnings.push(`${roundName}의 부담액이 총 금액보다 많아요.`);
        return;
      }
      if (rest > 0 && others.length === 0) {
        warnings.push(`${roundName}에 남은 금액을 나눌 다른 참석자가 없어요.`);
        return;
      }

      addShare(round.sponsor, index, round.sponsorAmount, true);
      for (const name of others) {
        addShare(name, index, rest / others.length);
      }
    } else {
      // 1/N: 총 금액을 참석 인원으로 나눠 각자에게 더함
      const share = round.amount / round.attendees.length;
      for (const name of round.attendees) {
        addShare(name, index, share);
      }
    }
    spent += round.amount;

    // 복사용 차수 요약 (예: "1차 320,000원 (4명, 김팀장 100,000원 부담)")
    let detail = `${round.attendees.length}명`;
    if (round.method === "sponsor") {
      detail += `, ${round.sponsor} ${round.sponsorAmount.toLocaleString("ko-KR")}원 부담`;
    }
    summaries.push(`${roundName} ${round.amount.toLocaleString("ko-KR")}원 (${detail})`);
  });

  // 사람별 최종 금액을 100원 단위로 올림
  const amounts = {};
  let collected = 0;
  for (const name of people) {
    amounts[name] = roundUpTo100(exact[name]);
    collected += amounts[name];
  }

  return { amounts, spent, collected, warnings, summaries, breakdown };
}


// ==============================
// 5. 도우미 함수
// ==============================

// "320,000" 같은 글자 → 320000 숫자 (숫자 외의 글자는 무시)
// 최대 9자리(999,999,999원)까지만 받음: 너무 큰 숫자는 컴퓨터가 정확히 계산하지 못함
function parseAmount(text) {
  const digits = text.replace(/[^0-9]/g, "").slice(0, 9);
  return Number(digits) || 0;
}

// 320000 숫자 → "320,000" 글자 (0이면 빈칸)
function formatAmount(number) {
  return number === 0 ? "" : number.toLocaleString("ko-KR");
}

// 차수 참석자를 참석자 목록 순서대로 정렬해서 돌려줌
function attendeesInOrder(round) {
  return people.filter((p) => round.attendees.includes(p));
}

// 금액 입력칸 만들기. 입력할 때마다 쉼표를 붙이고, 숫자는 onChange로 전달
function createAmountInput(value, onChange) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric"; // 휴대폰에서 숫자 키패드
  input.placeholder = "0";
  input.value = formatAmount(value);
  input.addEventListener("input", () => {
    const number = parseAmount(input.value);
    input.value = formatAmount(number);
    onChange(number);
  });
  return input;
}

// 입력 한 줄 만들기: [글자] [입력칸 뒷글자] 모양
// (class 이름은 style.css에서 디자인할 때 사용)
function createLabel(text, control, suffix = "") {
  const label = document.createElement("label");
  label.className = "field";

  const labelText = document.createElement("span");
  labelText.className = "field-label";
  labelText.textContent = text;

  const box = document.createElement("span");
  box.className = "field-box";
  box.append(control);
  if (suffix) {
    const unit = document.createElement("span");
    unit.className = "unit";
    unit.textContent = suffix;
    box.append(unit);
  }

  label.append(labelText, box);
  return label;
}

// 작은 소제목 만들기 (예: "참석", "정산 방식")
function createSubTitle(text) {
  const p = document.createElement("p");
  p.className = "sub-title";
  p.textContent = text;
  return p;
}


// ==============================
// 6. 화면 그리기: 데이터를 화면에 반영
// ==============================

// 전체 화면 다시 그리기
function render() {
  renderPeople();
  renderRounds();
  renderResult();
}

// people 목록을 보고 참석자 목록 화면을 새로 그림
function renderPeople() {
  peopleList.innerHTML = ""; // 기존 목록 지우기

  for (const name of people) {
    const li = document.createElement("li");
    li.className = "person-chip";
    li.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "chip-remove";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `${name} 삭제`);
    removeBtn.addEventListener("click", () => removePerson(name));

    li.appendChild(removeBtn);
    peopleList.appendChild(li);
  }
}

// rounds 목록을 보고 차수 카드들을 새로 그림
function renderRounds() {
  roundsList.innerHTML = "";

  rounds.forEach((round, index) => {
    roundsList.appendChild(createRoundCard(round, index));
  });

  // 3차까지 있으면 '차수 추가' 버튼 비활성화
  addRoundBtn.disabled = rounds.length >= MAX_ROUNDS;
}

// 계산 결과를 정산 결과 영역에 그림
function renderResult() {
  const result = calculate();

  // 사람별 금액
  resultList.innerHTML = "";
  for (const name of people) {
    const li = document.createElement("li");

    // 윗줄: 이름 ........ 금액
    const row = document.createElement("div");
    row.className = "result-row";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    const amountSpan = document.createElement("strong");
    amountSpan.textContent = `${result.amounts[name].toLocaleString("ko-KR")}원`;
    // 금액이 직전과 달라졌으면 반짝이는 효과
    if (name in previousAmounts && previousAmounts[name] !== result.amounts[name]) {
      amountSpan.className = "flash";
    }
    row.append(nameSpan, amountSpan);
    li.appendChild(row);

    // 아랫줄: 차수별 내역 (예: ● 1차 73,333  ● 2차 30,000)
    const parts = result.breakdown[name];
    if (parts.length > 0) {
      const detail = document.createElement("div");
      detail.className = "breakdown";
      for (const part of parts) {
        const item = document.createElement("span");
        item.className = `dot round-color-${part.round + 1}`;
        item.textContent =
          `${part.round + 1}차 ${Math.round(part.amount).toLocaleString("ko-KR")}` +
          (part.sponsor ? " (부담)" : "");
        detail.appendChild(item);
      }
      li.appendChild(detail);
    }

    resultList.appendChild(li);
  }
  previousAmounts = { ...result.amounts };

  // 총액
  totalMessage.textContent =
    result.spent > 0 ? `총 ${result.spent.toLocaleString("ko-KR")}원` : "";

  // 100원 올림으로 더 걷히는 금액
  const extra = result.collected - result.spent;
  extraMessage.textContent =
    extra > 0
      ? `100원 단위 올림으로 총 ${extra.toLocaleString("ko-KR")}원이 더 걷혀요.\n` + // \n: 줄바꿈
        `(먼저 결제한 분이 ${extra.toLocaleString("ko-KR")}원 더 받게 됩니다)`
      : "";

  // 계산에서 빠진 차수 안내
  warningList.innerHTML = "";
  for (const warning of result.warnings) {
    const li = document.createElement("li");
    li.textContent = "⚠️ " + warning;
    warningList.appendChild(li);
  }
}

// 차수 카드 하나 만들기
function createRoundCard(round, index) {
  const card = document.createElement("div");
  // round-color-1/2/3: 차수마다 다른 색 (style.css에서 정함)
  card.className = `round round-color-${index + 1}`;
  if (index === newRoundIndex) {
    card.classList.add("appear"); // 방금 추가된 카드만 나타나는 효과
  }

  // 제목 (1차, 2차, 3차) + 삭제 버튼 (차수가 2개 이상일 때만)
  const header = document.createElement("div");
  header.className = "round-header";
  const title = document.createElement("h3");
  const badge = document.createElement("span");
  badge.className = "round-badge";
  badge.textContent = index + 1;
  title.append(badge, "차");
  header.appendChild(title);
  if (rounds.length > 1) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "text-btn";
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => removeRound(index));
    header.appendChild(removeBtn);
  }
  card.appendChild(header);

  // 총 금액
  const amountInput = createAmountInput(round.amount, (number) => {
    round.amount = number;
    renderResult(); // 금액은 입력 중이라 결과만 다시 그림
  });
  card.appendChild(createLabel("총 금액", amountInput, "원"));

  // 참석자 체크
  card.appendChild(createSubTitle("참석"));

  if (people.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "먼저 위에서 참석자를 추가해 주세요.";
    card.appendChild(empty);
  }
  const chips = document.createElement("div");
  chips.className = "chips";
  for (const name of people) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = round.attendees.includes(name);
    checkbox.addEventListener("change", () => {
      toggleAttendee(round, name, checkbox.checked);
    });
    const label = document.createElement("label");
    // 체크된 사람은 'checked' 이름표를 붙여서 색으로 구분
    label.className = checkbox.checked ? "chip checked" : "chip";
    label.append(checkbox, name);
    chips.appendChild(label);
  }
  card.appendChild(chips);

  // 정산 방식
  card.appendChild(createSubTitle("정산 방식"));
  const segmented = document.createElement("div");
  segmented.className = "segmented";

  const methods = [
    { value: "equal", text: "1/N" },
    { value: "sponsor", text: "특정인 부담 + 1/N" },
  ];
  for (const method of methods) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `method-${index}`; // 차수마다 이름이 달라야 서로 안 섞임
    radio.checked = round.method === method.value;
    radio.addEventListener("change", () => changeMethod(round, method.value));
    const label = document.createElement("label");
    label.className = radio.checked ? "segment selected" : "segment";
    label.append(radio, method.text);
    segmented.appendChild(label);
  }
  card.appendChild(segmented);

  // '특정인 부담'일 때만 부담자, 부담액 입력칸 표시
  if (round.method === "sponsor") {
    const sponsorBox = document.createElement("div");
    sponsorBox.className = "sponsor";

    // 부담자 선택: 이 차수 참석자 중에서만 고를 수 있음
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "선택";
    select.appendChild(placeholder);
    for (const name of attendeesInOrder(round)) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
    select.value = round.sponsor;
    select.addEventListener("change", () => {
      round.sponsor = select.value;
      renderResult();
    });
    sponsorBox.appendChild(createLabel("부담자", select));

    // 부담액
    const sponsorInput = createAmountInput(round.sponsorAmount, (number) => {
      round.sponsorAmount = number;
      renderResult();
    });
    sponsorBox.appendChild(createLabel("부담액", sponsorInput, "원"));

    card.appendChild(sponsorBox);
  }

  return card;
}


// ==============================
// 7. 복사: 결과를 단톡방에 붙여넣을 글로 만들어 복사
// ==============================

// 단톡방용 글 만들기
function buildCopyText(result) {
  const lines = [];
  lines.push("[회식 정산]");
  lines.push(...result.summaries);
  lines.push("──────────");
  for (const name of people) {
    lines.push(`${name} ${result.amounts[name].toLocaleString("ko-KR")}원`);
  }
  lines.push("──────────");
  lines.push(`총 ${result.spent.toLocaleString("ko-KR")}원`);

  const extra = result.collected - result.spent;
  if (extra > 0) {
    lines.push(`※ 100원 단위 올림으로 ${extra.toLocaleString("ko-KR")}원이 더 걷혀요.`);
  }
  return lines.join("\n"); // 한 줄씩 줄바꿈으로 이어 붙임
}

// 글자를 클립보드에 복사
async function copyToClipboard(text) {
  try {
    // 요즘 브라우저의 기본 방법
    await navigator.clipboard.writeText(text);
  } catch {
    // 카카오톡 인앱 브라우저처럼 위 방법이 막힌 곳을 위한 예전 방법:
    // 안 보이는 입력칸에 글을 넣고 '복사' 명령을 실행
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

// '복사' 버튼을 눌렀을 때
async function copyResult() {
  const result = calculate();

  if (people.length === 0 || result.spent === 0) {
    alert("복사할 결과가 없어요. 참석자와 금액을 먼저 입력해 주세요.");
    return;
  }
  if (result.warnings.length > 0 &&
      !confirm("계산에서 빠진 차수가 있어요. 그래도 복사할까요?")) {
    return;
  }

  await copyToClipboard(buildCopyText(result));

  showToast("✅ 복사됐어요! 단톡방에 붙여넣으세요");
}

// 화면 아래에 알림을 잠깐 띄움
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}


// ==============================
// 8. 이벤트 연결: 사용자가 무언가 하면 함수 실행
// ==============================

// '추가' 버튼을 누르면 추가
addPersonBtn.addEventListener("click", addPerson);

// 입력칸에서 엔터를 눌러도 추가
nameInput.addEventListener("keydown", (event) => {
  // 한글 입력 중(조합 중) 엔터는 무시해야 마지막 글자가 중복 입력되지 않음
  if (event.key === "Enter" && !event.isComposing) {
    addPerson();
  }
});

// '차수 추가' 버튼
addRoundBtn.addEventListener("click", addRound);

// '단톡방용 복사' 버튼
copyBtn.addEventListener("click", copyResult);


// ==============================
// 9. 처음 화면 그리기
// ==============================

// 영수증에 오늘 날짜 표시 (예: 2026. 10. 21.)
receiptDate.textContent = new Date().toLocaleDateString("ko-KR");

render();
