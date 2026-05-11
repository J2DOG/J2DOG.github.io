---
layout: post
title: 单车模型横向动力学误差模型MPC控制
date: 2026-02-16
description: 将车辆横向动力学误差模型近似为含扰动的 LTI 系统，设计线性 MPC 控制器，并通过增广状态空间形式将等式约束融入代价函数，得到标准 QP 便于实时求解。
tags: mpc vehicle-control lateral-control
categories: control
---

相比于 PID 和 LQR，模型预测控制（MPC）能够将控制问题表述为带约束的优化问题，通过在代价函数中权衡各项性能指标，添加合理约束，实现更灵活且直观的控制设计。然而，这种方法也带来了更高的计算复杂度，在嵌入式平台上实现高效的 MPC 往往需要针对算法结构进行优化。对于线性系统，构造计算高效的增广形式是实现实时控制的关键。

本文将车辆横向动力学误差模型近似为线性时不变（LTI）系统，在此基础上设计线性 MPC 控制器，并通过增广状态空间形式提升计算效率。同时结合系统特性，进一步分析该控制问题的挑战。
## 被控对象建模
(参考老王的模型,[视频](https://www.bilibili.com/video/BV1EZ4y1T7jG/?spm_id_from=333.1387.homepage.video_card.click)中给到了详细的推导,不再赘述。亦可参考书目Vehicle Dynamics and Control)

动力学**误差**状态方程:

$$
\small
\begin{pmatrix}
\dot{e}_d \\
\ddot{e}_d \\
\dot{e}_\varphi \\
\ddot{e}_\varphi
\end{pmatrix}
=
\begin{pmatrix}
0 & 1 & 0 & 0 \\

0 &
-\dfrac{C_{\alpha f}+C_{\alpha r}}{mV_x} &
\dfrac{C_{\alpha f}+C_{\alpha r}}{m} &
\dfrac{bC_{\alpha r}-aC_{\alpha f}}{mV_x} \\

0 & 0 & 0 & 1 \\

0 &
\dfrac{bC_{\alpha r}-aC_{\alpha f}}{IV_x} &
\dfrac{aC_{\alpha f}-bC_{\alpha r}}{I} &
-\dfrac{a^2C_{\alpha f}+b^2C_{\alpha r}}{IV_x}
\end{pmatrix}
\begin{pmatrix}
e_d \\
\dot{e}_d \\
e_\varphi \\
\dot{e}_\varphi
\end{pmatrix}
+
\begin{pmatrix}
0 \\
\dfrac{C_{\alpha f}}{m} \\
0 \\
\dfrac{aC_{\alpha f}}{I}
\end{pmatrix}
\delta
+
\begin{pmatrix}
0\\
\dfrac{bC_{\alpha r}-aC_{\alpha f}}{mV_x} - V_x \\
0 \\
-\dfrac{a^2C_{\alpha f}+b^2C_{\alpha r}}{IV_x}
\end{pmatrix}
\dot{\varphi}_r
$$

四维状态量为横向误差、横向误差速度、(横摆角-轨迹航向)误差、(横摆角-轨迹航向)误差速度。时变参考并直接进入代价,而是通过初始误差定义再通过轨迹航向角速度进前馈补偿。状态方程$\dot{e}=Ae+B\delta+C\dot{\varphi}^{ref}$。离散化后记作
$$e_{k+1}=A_de_k+B_d\delta_k+C_d\dot{\varphi}^{ref}_k$$
从控制的角度来看,轨迹航向的角速度$\dot{\varphi_r}$给状态方程带来了扰动项$C_d\dot{\varphi}^{ref}_k$。

假设我们使用一个离散lqr控制器:$K = dlqr(A_d, B_d, Q, R)$,但LQR只解决了$$e_{k+1}=A_de_k+B_d\delta_k = (A_d-B_dK)e_k$$

**假设**,我们真的能保证$e_{k+1}=e_{k}=0$,那带入状态方程后得到$0=0+C_d\dot{\varphi}^{ref}_k$。

这显然是不完美的,因为通过Ricati方程求解出的LQR没有处理这项我们已经知道的"扰动"。(LQR的求解不再展开,通过计算前馈量的方法来消除使用LQR的稳态误差可以参考[老王的视频](https://www.bilibili.com/video/BV1P54y1m7CZ/?spm_id_from=333.788.recommend_more_video.0&trackid=web_related_0.router-related-2481894-v7bf2.1771217097061.494))。
而如果使用MPC构造成优化问题来求解,我们会带着这一项进入优化,而不是单独拿出来求解。反观物理世界,$\dot{\varphi}^{\mathrm{ref}}_k$对应了轨迹曲率的不断变化,这正是我们"为什么"需要转动方向盘,以及解决这个控制问题的主要难点。注意到, 轨迹的未来变化趋势显然是可以依据规划提前"看到"的。

所以可以引入轨迹航向这一已知量作为输入前馈。
$$
e_{k+1} = A_de_k + B_d(\delta_k+δ^{ff}_k) + C_d\dot{\varphi}^{ref}_k
= A_de_k + B_d\delta_k+ d_k
$$
其中$d_k = B_dδ^{ff}_k + C_d\dot{\varphi}^{ref}_k$,注意对于预测时域内的$d_k$,我们认为是已知的。这样就构造出了一个常见的LTI系统。

(注意直到这里,假设包含了:1.横摆角和航向角的小角度假设; 2.纵向速度$V_x$时不变; 3.离散化误差以及其他的未知扰动。)

下面,会将这个MPC问题变换为不含等式约束的QP问题,主要就是计算状态转移,将等式约束(在这里就是状态方程)融合到cost function,加速运算。

## 构造MPC控制器
(从这里开始, $A_d,B_d,C_d$记作$A,B,C$, $δ_k$记作$u_k$)

### 预测时域内的状态转移

在时刻 $t$ 做预测，时域长度 $N$。从当前时刻t出发,递推$N$ 步:

- 一步:$e_{t+1} = Ae_t + Bu_t + d_t$
- 两步:$e_{t+2} = A(Ae_t + Bu_t + d_t) + Bu_{t+1} + d_{t+1}$
- ......

递推展开可得（$i=1,\dots,N$）：
$$
e_{t+i}
=
A^i e_t
+
\sum_{j=0}^{i-1}A^{i-1-j}B\,u_{t+j}
+
\sum_{j=0}^{i-1}A^{i-1-j}d_{t+j}。
$$

可见,状态是初始状态+输入+误差的不断递推累积。

在某一时刻,初始状态记作$e_0$。 然后定义优化问题的决策变量（输入序列）：

$$
U \triangleq
\begin{bmatrix}
u_0\\ u_{1}\\ \vdots\\ u_{N-1}
\end{bmatrix}\in\mathbb{R}^{N×nx}
$$

定义预测状态向量：
$$
E \triangleq
\begin{bmatrix}
e_{1}\\ e_{2}\\ \vdots\\ e_{N}
\end{bmatrix}\in\mathbb{R}^{N×nu}
$$

定义扰动序列堆叠：
$$
D \triangleq
\begin{bmatrix}
d_0\\ d_{1}\\ \vdots\\ d_{N-1}
\end{bmatrix}\in\mathbb{R}^{N×nd}
$$

---

### 消去动力学等式约束

预测时域内的状态转移可以写在一起:
$$
E=\mathcal{A}e_0+\mathcal{B}U+\mathcal{E}D
$$

其中

- 初值传播矩阵
$$
\mathcal{A}=
\begin{bmatrix}
A\\ A^2\\ \vdots\\ A^N
\end{bmatrix}\in\mathbb{R}^{Nn\times n}。
$$

- 输入传播矩阵
$$
\mathcal{B}=
\begin{bmatrix}
B & 0 & \cdots & 0\\
AB & B & \cdots & 0\\
A^2B & AB & \ddots & \vdots\\
\vdots & \vdots & \ddots & 0\\
A^{N-1}B & A^{N-2}B & \cdots & B
\end{bmatrix}\in\mathbb{R}^{Nn\times Nm}。
$$

- 扰动传播矩阵
$$
\mathcal{E}=
\begin{bmatrix}
I & 0 & \cdots & 0\\
A & I & \cdots & 0\\
A^2 & A & \ddots & \vdots\\
\vdots & \vdots & \ddots & 0\\
A^{N-1} & A^{N-2} & \cdots & I
\end{bmatrix}\in\mathbb{R}^{Nn\times Nn}。
$$

将所有“已知项”合并为偏置向量
$$
\eta \triangleq \mathcal{A}e_0+\mathcal{E}D,
\qquad\Rightarrow\qquad
E=\mathcal{B}U+\eta。
$$

---

### 标准 QP 形式（将等式约束融入代价函数）

考虑典型 MPC 代价
$$
J=
\sum_{i=1}^{N-1} e_i^\top Q e_i + e_N^\top P e_N
+\sum_{i=0}^{N-1} u_i^\top R u_i。
$$

可以构造块对角(block diagnol)权重矩阵,
$$
\bar Q=\mathrm{blkdiag}(\underbrace{Q,\dots,Q}_{N-1},P)\in\mathbb{R}^{Nn\times Nn},\qquad
\bar R=\mathrm{blkdiag}(\underbrace{R,\dots,R}_{N})\in\mathbb{R}^{Nm\times Nm}。
$$

则
$$
J = E^\top \bar Q E + U^\top \bar R U。
$$

代入 $E=\mathcal{B}U+\eta$ 并丢弃常数项 $\eta^\top\bar Q\eta$，得到标准 QP:
$$
\boxed{
\min_{U}\ \frac12 U^\top H U + f^\top U
}
$$
其中

$$
H = 2\left(\mathcal{B}^\top \bar Q\,\mathcal{B}+\bar R\right),\qquad
f = 2\,\mathcal{B}^\top \bar Q\,\eta。
$$

然后看情况设置线性约束$U_{min}\le U \le U_{max}$。


这样就可以方便的调用各种求解器,在嵌入式平台构造MPC控制器。
