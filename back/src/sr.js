import { Telegraf, Markup } from "telegraf";

const bot = new Telegraf("7312402670:AAEgb72S8pIWWdsxDYK17d-nmLTB5PYxI0I");
let players = [];
let leaders = [];
let gameState = "waiting_for_players"; // Состояние игры
let gameStartTime = null; // Время начала игры
let pendingMove = null; // { player: "username", fromTeam: "team1", toTeam: "team2", confirmedBy: [] }

// Функция для случайного перемешивания массива
const shuffleArray = (arr) => {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]]; // Меняем местами
	}
};

// Приветственное сообщение и кнопка присоединения
bot.start((ctx) => {
	ctx.reply(
		`Привет, ${ctx.from.username}! Я — бот для организации игры. Для того чтобы присоединиться, нажми на кнопку ниже. Автор: Комил Муминов.`,
		Markup.inlineKeyboard([
			[Markup.button.callback("Присоединиться", "join_game")],
		]),
	);
});

// Присоединение к игре
bot.action("join_game", (ctx) => {
	const username = ctx.from.username;

	if (!username) {
		return ctx.reply("Для участия в игре нужно указать имя пользователя.");
	}

	players.push(username);

	if (players.length < 10) {
		return ctx.reply(
			`Игрок ${username} присоединился к игре. Ожидаем еще игроков...`,
		);
	}

	// Когда 10 игроков собрано
	shuffleArray(players); // Перемешиваем список игроков

	const team1 = players.slice(0, 5); // Первая команда
	const team2 = players.slice(5, 10); // Вторая команда

	// Первый лидер (тот, кто создал игру)
	leaders[0] = team1[0]; // Лидер 1 - первый игрок из команды 1
	// Второй лидер (тот, кого выбрал первый лидер)
	leaders[1] = team2[0]; // Лидер 2 - первый игрок из команды 2

	// Изменяем состояние игры
	gameState = "waiting_for_leaders_confirmation";

	// Отправляем лидерам сообщение с подтверждением состава
	ctx.reply(`Команда 1 (Leader 1 - ${leaders[0]}): ${team1.join(", ")}`);
	ctx.reply(`Команда 2 (Leader 2 - ${leaders[1]}): ${team2.join(", ")}`);

	// Кнопка для согласования состава
	ctx.reply(
		"Лидеры, подтвердите состав команд.",
		Markup.inlineKeyboard([
			[Markup.button.callback("Согласен с составом", "confirm_teams")],
		]),
	);

	// Просим лидеров установить время начала игры
	ctx.reply("Лидеры, выберите время начала игры (например, 15:30):");
	gameState = "waiting_for_time";
});

// Лидеры устанавливают время начала игры
bot.on("text", (ctx) => {
	if (gameState === "waiting_for_time" && leaders.includes(ctx.from.username)) {
		const time = ctx.message.text.trim();

		// Проверка корректности времени
		const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5]?[0-9])$/;
		if (!timeRegex.test(time)) {
			return ctx.reply("Неверный формат времени. Попробуйте еще раз.");
		}

		gameStartTime = time;
		gameState = "waiting_for_leaders_confirmation"; // Сменить состояние обратно

		// Подтверждение времени
		ctx.reply(`Время начала игры установлено на ${time}.`);

		// Напоминание за 30 минут
		setInterval(() => {
			const now = new Date();
			const [hours, minutes] = gameStartTime.split(":").map(Number);
			const gameStart = new Date(now.setHours(hours, minutes, 0, 0));

			// Напоминаем за 30 минут
			if (
				gameStart - now <= 30 * 60 * 1000 &&
				gameStart - now > 29 * 60 * 1000
			) {
				// Отправка напоминания всем игрокам
				players.forEach((player) => {
					bot.telegram.sendMessage(
						`@${player}`,
						"Через 30 минут начинается игра! Подготовьтесь!",
					);
				});
			}

			// Когда время начала игры наступает
			if (gameStart - now <= 0) {
				// Останавливаем дальнейшую проверку
				clearInterval(this);

				// Сообщаем всем игрокам, что игра началась
				players.forEach((player) => {
					bot.telegram.sendMessage(`@${player}`, "Игра началась! Всем удачи!");
				});

				// Меняем состояние игры
				gameState = "game_in_progress";

				// Допустим, игра длится 1 час (60 минут)
				setTimeout(() => {
					// Игра завершена через 1 час
					players.forEach((player) => {
						bot.telegram.sendMessage(
							`@${player}`,
							"Игра завершена! Спасибо за участие!",
						);
					});

					// Очищаем список игроков для новой игры
					players = [];
					gameState = "waiting_for_players"; // Возвращаем состояние игры

					// Кнопка для начала новой игры
					players.forEach((player) => {
						bot.telegram.sendMessage(
							`@${player}`,
							"Новая игра начинается! Нажмите 'Сыграть', чтобы начать снова.",
							Markup.inlineKeyboard([
								[Markup.button.callback("Сыграть", "start_new_game")],
							]),
						);
					});
				}, 60 * 60 * 1000); // Игра длится 1 час (60 минут)
			}
		}, 60000); // Проверка каждую минуту
	}
});

// Согласие с составом
bot.action("confirm_teams", (ctx) => {
	const username = ctx.from.username;

	// Лидеры могут подтвердить состав
	if (leaders.includes(username)) {
		// Проверка, подтвердили ли оба лидера
		if (leaders.every((leader) => ctx.from.username === leader)) {
			ctx.reply(`Состав команд подтвержден!`);

			// Отправляем всем игрокам информацию о составе команд и времени начала
			players.forEach((player) => {
				bot.telegram.sendMessage(
					`@${player}`,
					`Состав команд утвержден!\nКоманда 1 (Leader - ${
						leaders[0]
					}): ${players.slice(0, 5).join(", ")}\nКоманда 2 (Leader - ${
						leaders[1]
					}): ${players
						.slice(5, 10)
						.join(", ")}\nВремя начала игры: ${gameStartTime}`,
				);
			});

			// Очищаем массив игроков для новой игры
			players = [];
			gameState = "waiting_for_players"; // Сбрасываем состояние игры

			// Кнопка для начала новой игры
			ctx.reply(
				"Новая игра начинается! Нажмите 'Сыграть', чтобы начать снова.",
				Markup.inlineKeyboard([
					[Markup.button.callback("Сыграть", "start_new_game")],
				]),
			);
		}
	}
});

// Запланировать новую игру
bot.action("start_new_game", (ctx) => {
	players = []; // Сбросить список игроков
	gameState = "waiting_for_players"; // Установить начальное состояние игры
	ctx.reply(
		"Начинаем набирать игроков для новой игры. Нажмите 'Присоединиться'.",
	);
	// Кнопка для присоединения
	ctx.reply(
		"Нажмите кнопку ниже, чтобы присоединиться к новой игре.",
		Markup.inlineKeyboard([
			[Markup.button.callback("Присоединиться", "join_game")],
		]),
	);
});

// Лидер инициирует перемещение игрока
bot.action(/move_to_(team1|team2)_(.*)/, (ctx) => {
	const username = ctx.from.username;
	const playerToMove = ctx.match[2];
	const targetTeam = ctx.match[1]; // "team1" или "team2"

	if (!leaders.includes(username)) {
		return ctx.reply("Только лидеры могут менять состав команд.");
	}

	// Проверяем, кто инициировал перемещение
	const fromTeam = targetTeam === "team1" ? "team2" : "team1"; // Если перемещение в команду 1, то из команды 2 и наоборот

	// Проверяем, что игрок находится в правильной команде
	if (
		(fromTeam === "team1" && players.indexOf(playerToMove) < 5) ||
		(fromTeam === "team2" && players.indexOf(playerToMove) >= 5)
	) {
		pendingMove = {
			player: playerToMove,
			fromTeam,
			toTeam: targetTeam,
			confirmedBy: [username],
		};

		// Уведомление лидеров о необходимости подтвердить перемещение
		ctx.reply(
			`${playerToMove} должен быть перемещен из ${fromTeam} в ${targetTeam}. Лидер 2, подтвердите это.`,
			Markup.inlineKeyboard([
				[Markup.button.callback("Подтвердить перемещение", "confirm_move")],
			]),
		);
	} else {
		ctx.reply("Игрок не находится в нужной команде.");
	}
});

// Подтверждение перемещения
bot.action("confirm_move", (ctx) => {
	if (!pendingMove) {
		return ctx.reply("Нет ожидающих перемещений.");
	}

	const username = ctx.from.username;

	// Проверяем, что это второй лидер
	if (pendingMove.confirmedBy.includes(username)) {
		return ctx.reply("Вы уже подтвердили перемещение.");
	}

	// Подтверждаем перемещение
	pendingMove.confirmedBy.push(username);
	if (pendingMove.confirmedBy.length === 2) {
		// Окончательно перемещаем игрока
		if (pendingMove.toTeam === "team1") {
			players.splice(players.indexOf(pendingMove.player), 1);
			players.splice(0, 0, pendingMove.player);
		} else {
			players.splice(players.indexOf(pendingMove.player), 1);
			players.push(pendingMove.player);
		}

		// Информируем обоих лидеров и всех игроков
		bot.telegram.sendMessage(
			`@${leaders[0]}`,
			`Игрок ${pendingMove.player} перемещен в ${pendingMove.toTeam}.`,
		);
		bot.telegram.sendMessage(
			`@${leaders[1]}`,
			`Игрок ${pendingMove.player} перемещен в ${pendingMove.toTeam}.`,
		);
		pendingMove = null; // Сбросить текущую перемещенную заявку
	}
});

// Запуск бота
bot.launch();
