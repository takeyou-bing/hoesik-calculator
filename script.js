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


// ==============================
// 2. 화면 요소 찾기 (index.html의 id로 찾음)
// ==============================

const nameInput = document.getElementById("name-input");
const addPersonBtn = document.getElementById("add-person-btn");
const peopleList = document.getElementById("people-list");
const roundsList = document.getElementById("rounds-list");
const addRoundBtn = document.getElementById("add-round-btn");


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
  render();
}

// 차수 삭제 (뒤 차수는 번호가 하나씩 당겨짐)
function removeRound(index) {
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
// 4. 도우미 함수
// ==============================

// "320,000" 같은 글자 → 320000 숫자 (숫자 외의 글자는 무시)
function parseAmount(text) {
  return Number(text.replace(/[^0-9]/g, "")) || 0;
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

// <label>글자 [입력칸] 뒷글자</label> 모양 만들기
function createLabel(text, control, suffix = "") {
  const label = document.createElement("label");
  label.append(text + " ", control);
  if (suffix) {
    label.append(" " + suffix);
  }
  return label;
}


// ==============================
// 5. 화면 그리기: 데이터를 화면에 반영
// ==============================

// 전체 화면 다시 그리기
function render() {
  renderPeople();
  renderRounds();
}

// people 목록을 보고 참석자 목록 화면을 새로 그림
function renderPeople() {
  peopleList.innerHTML = ""; // 기존 목록 지우기

  for (const name of people) {
    const li = document.createElement("li");
    li.textContent = name + " ";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
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

// 차수 카드 하나 만들기
function createRoundCard(round, index) {
  const card = document.createElement("div");
  card.className = "round";

  // 제목 (1차, 2차, 3차) + 삭제 버튼 (차수가 2개 이상일 때만)
  const title = document.createElement("h3");
  title.textContent = `${index + 1}차 `;
  if (rounds.length > 1) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => removeRound(index));
    title.appendChild(removeBtn);
  }
  card.appendChild(title);

  // 총 금액
  const amountInput = createAmountInput(round.amount, (number) => {
    round.amount = number;
  });
  card.appendChild(createLabel("총 금액", amountInput, "원"));

  // 참석자 체크
  const attendeeTitle = document.createElement("p");
  attendeeTitle.textContent = "참석";
  card.appendChild(attendeeTitle);

  if (people.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "먼저 위에서 참석자를 추가해 주세요.";
    card.appendChild(empty);
  }
  for (const name of people) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = round.attendees.includes(name);
    checkbox.addEventListener("change", () => {
      toggleAttendee(round, name, checkbox.checked);
    });
    const label = document.createElement("label");
    label.append(checkbox, " " + name);
    card.appendChild(label);
  }

  // 정산 방식
  const methodTitle = document.createElement("p");
  methodTitle.textContent = "정산 방식";
  card.appendChild(methodTitle);

  const methods = [
    { value: "equal", text: "1/N" },
    { value: "sponsor", text: "특정인 부담 후 나머지 1/N" },
  ];
  for (const method of methods) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `method-${index}`; // 차수마다 이름이 달라야 서로 안 섞임
    radio.checked = round.method === method.value;
    radio.addEventListener("change", () => changeMethod(round, method.value));
    const label = document.createElement("label");
    label.append(radio, " " + method.text);
    card.appendChild(label);
  }

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
    });
    sponsorBox.appendChild(createLabel("부담자", select));

    // 부담액
    const sponsorInput = createAmountInput(round.sponsorAmount, (number) => {
      round.sponsorAmount = number;
    });
    sponsorBox.appendChild(createLabel("부담액", sponsorInput, "원"));

    card.appendChild(sponsorBox);
  }

  return card;
}


// ==============================
// 6. 이벤트 연결: 사용자가 무언가 하면 함수 실행
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


// ==============================
// 7. 처음 화면 그리기
// ==============================
render();
